import { HttpError } from '../models/errorModel.js';
import generateOTP from '../utils/generateOTP.js';
import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import sendEmail from '../utils/sendEmail.js';
import User from '../models/userModel.js';
import crypto from 'crypto';

const argonOptions = {
  type: argon2.argon2id,
  memoryCost: 2 ** 17,
  timeCost: 4,
  parallelism: 2,
}

// Password Prehash Helper
function prehashPassword(password) {
  return crypto
    .createHash('sha256')
    .update(password)
    .digest('hex');
}

import { getPeppers, getCurrentPepper } from '../utils/peppers.js'

async function verifyPasswordWithPeppers(storedHash, prehashedPassword) {
  const peppers = getPeppers();
  for (let i = 0; i < peppers.length; i++) {
    try {
      if (await argon2.verify(storedHash, (peppers[i] || '') + prehashedPassword)) return i;
    } catch (e) {
      // ignore invalid hash formats
    }
  }
  return null;
}

async function hashWithCurrentPepper(prehashedPassword, options = argonOptions) {
  const current = getCurrentPepper();
  return await argon2.hash((current || '') + prehashedPassword, options);
}

// ---------------- SEND RESET OTP ----------------
const sendResetOTP = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return next(new HttpError('Email is required', 400));

    const user = await User.findOne({ email });
    if (!user) return next(new HttpError('No account found with that email', 404));

    const otp = generateOTP();
    const otpExpiry = 15 * 60 * 1000;
    const minutes = otpExpiry / 60000;
    const otpExpiresAt = Date.now() + 15 * 60 * 1000;

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
       <p>This code expires in ${minutes} minute${minutes > 1 ? "s" : ""}.</p>`
    );

    return res.status(200).json({ message: 'OTP sent successfully' });
  } catch (error) {
    return next(new HttpError(error.message, 500));
  }
};

// ---------------- RESET PASSWORD ----------------
// Endpoint used when a user has forgotten their password.
// Expects: { email, otp, newPassword }
// Verifies latest OTP (code + expiry) then updates password using current pepper.
const resetPassword = async (req, res, next) => {
  try {
    const { otp, newPassword } = req.body;
    if (!otp || !newPassword)
      return next(new HttpError('OTP and new password are required', 400));

    // Find user by OTP code stored in any otp entry
    const user = await User.findOne({ 'otp.code': otp });
    if (!user || !user.otp || user.otp.length === 0)
      return next(new HttpError('Invalid request', 400));

    // Find the otp entry that matches the provided code
    const otpEntry = user.otp.find(o => o.code.toString() === otp.toString());
    if (!otpEntry) return next(new HttpError('Invalid OTP', 400));

    // Check expiry
    if (Date.now() > otpEntry.expiresAt)
      return next(new HttpError('OTP expired. Request a new one.', 400));

    // All good - hash new password and update
    const prehashedNewPassword = prehashPassword(newPassword);
    const hashedPassword = await hashWithCurrentPepper(prehashedNewPassword, argonOptions);
    user.password = hashedPassword;

    // mark OTPs cleared
    user.otp = [];
    await user.save();

    await sendEmail(
      user.email,
      'Password Reset Confirmation & Security Notice.',
      `<h4>Hello</h4>
       <p>Your password reset request has been received and processed by our team. 
       The password associated with your Mern Blog account has been sucessfully updated.</p>
       <p>If you initiated this change no further action is required.</p>
       <p>However if you did not request a password reset, treat this as a security alert.
       Reset your password immediately and secure your account to prevent unauthorized access.</p>
       <p>If you need help, contact Support</p>

       <h4>
        Regards,
        <p>Mern Blog Team</p>
       </h4>
      `
    );

    // Issue JWT token so the user can be automatically signed in after resetting
    const { _id: id, name } = user;
    const token = jwt.sign({ id, name }, process.env.JWT_SECRET, { expiresIn: '6h' });
    const posts = user.posts || 0;

    return res.status(200).json({ token, id, name, posts });
  } catch (error) {
    return next(new HttpError(error.message, 500));
  }
};

export { sendResetOTP, resetPassword };
