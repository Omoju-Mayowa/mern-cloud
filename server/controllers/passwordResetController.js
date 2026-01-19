import { HttpError } from '../models/errorModel.js';
import generateOTP from '../utils/generateOTP.js';
import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import sendEmail from '../utils/sendEmail.js';
import User from '../models/userModel.js';
import crypto from 'crypto';
import { getPeppers, getCurrentPepper } from '../utils/peppers.js'

// Consistent with your User Controller
const argonOptionsStrong = {
  type: argon2.argon2id,
  memoryCost: 2 ** 17,
  timeCost: 6,
  parallelism: 4,
}

// Password Prehash Helper
function prehashPassword(password) {
  return crypto
    .createHash('sha256')
    .update(password)
    .digest('hex');
}

/**
 * Returns the hash AND the version index to ensure 
 * the database stays in sync with the pepper used.
 */
async function hashWithCurrentPepper(prehashedPassword) {
  const current = getCurrentPepper();
  const peppers = getPeppers();
  const hash = await argon2.hash((current || '') + prehashedPassword, argonOptionsStrong);
  const version = peppers.indexOf(current);
  
  return {
    hash,
    version: version !== -1 ? version : 0
  };
}

// ---------------- SEND RESET OTP ----------------
const sendResetOTP = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return next(new HttpError('Email is required', 400));

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return next(new HttpError('No account found with that email', 404));

    const otp = generateOTP();
    const otpExpiry = 15 * 60 * 1000;
    const minutes = otpExpiry / 60000;
    const otpExpiresAt = Date.now() + otpExpiry;

    // Push new OTP to the array
    user.otp.push({
      code: otp,
      expiresAt: otpExpiresAt,
      verified: false,
      createdAt: new Date()
    });

    await user.save();

    await sendEmail(
      user.email,
      'Password Reset OTP',
      `<h4>Mern Blog</h4>
       <p>Your password reset OTP is <b>${otp}</b></p>
       <p>This code expires in ${minutes} minutes.</p>`
    );

    return res.status(200).json({ message: 'OTP sent successfully' });
  } catch (error) {
    return next(new HttpError(error.message, 500));
  }
};

// ---------------- RESET PASSWORD ----------------
const resetPassword = async (req, res, next) => {
  try {
    const { otp, newPassword } = req.body;
    if (!otp || !newPassword)
      return next(new HttpError('OTP and new password are required', 400));

    // Find user by OTP code
    const user = await User.findOne({ 'otp.code': otp });
    if (!user || !user.otp || user.otp.length === 0)
      return next(new HttpError('Invalid request or OTP', 400));

    // Find specific entry
    const otpEntry = user.otp.find(o => o.code.toString() === otp.toString());
    if (!otpEntry) return next(new HttpError('Invalid OTP', 400));

    // Check expiry
    if (Date.now() > otpEntry.expiresAt)
      return next(new HttpError('OTP expired. Request a new one.', 400));

    // --- KEY FIX: Hash with latest pepper and capture VERSION ---
    const prehashedNewPassword = prehashPassword(newPassword);
    const { hash, version } = await hashWithCurrentPepper(prehashedNewPassword);
    
    user.password = hash;
    user.pepperVersion = version; // CRITICAL: Updates DB to the correct pepper index

    // Clear all OTPs after successful reset
    user.otp = [];
    await user.save();

    // Confirmation Email
    await sendEmail(
      user.email,
      'Password Reset Confirmation',
      `<h4>Hello ${user.name}</h4>
       <p>Your password has been successfully updated.</p>
       <p>If you did not initiate this change, please secure your account immediately.</p>
       <h4>Regards,<br/>Mern Blog Team</h4>`
    );

    // Issue JWT for auto-login
    const token = jwt.sign(
      { id: user._id, name: user.name }, 
      process.env.JWT_SECRET, 
      { expiresIn: '6h' }
    );

    return res.status(200).json({ 
        token, 
        id: user._id, 
        name: user.name, 
        avatar: user.avatar // Added for frontend consistency
    });
    
  } catch (error) {
    return next(new HttpError(error.message, 500));
  }
};

export { sendResetOTP, resetPassword };
