// backend/controllers/userControllers.js
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import crypto from 'crypto';
import User from '../models/userModel.js';
import { HttpError } from "../models/errorModel.js";
import { sendSSE } from './postControllers.js';
import { consumeIfNotWhitelisted, isIpWhitelisted, limiterSlowBruteByIP } from '../middleware/loginRateLimiter.js';
import sendEmail from '../utils/sendEmail.js';
import __dirname from '../utils/directory.js';
import s3 from '../utils/r2Client.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getPeppers, getCurrentPepper } from '../utils/peppers.js';

const avatarSizeBytes = 10485760; // 10MB
const avatarSizeMb = (avatarSizeBytes / (1024 * 1024)).toFixed(2) + 'Mb';
const SHADOW_DELAY_BLOCKED = 10 * 1000;
const SHADOW_DELAY_FAILED = 10; // small delay for failed logins
const failedLogin = 5;

// Argon2 options
const argonOptions = {
  type: argon2.argon2id,
  memoryCost: 2 ** 16,
  timeCost: 4,
  parallelism: 2,
};
const argonOptionsStrong = {
  type: argon2.argon2id,
  memoryCost: 2 ** 17,
  timeCost: 6,
  parallelism: 4,
  version: 0x13,
};

// Helpers
const sleep = ms => new Promise(r => setTimeout(r, ms));
const prehashPassword = password => crypto.createHash('sha256').update(password).digest('hex');
const needsMonthlyRehash = lastRehash => !lastRehash || (Date.now() - lastRehash.getTime() >= 30 * 24 * 60 * 60 * 1000);

async function verifyPasswordWithPeppers(storedHash, prehashedPassword, userPepperVersion) {
  const peppers = getPeppers();
  if (!peppers.length) return null;

  let start = 0;
  if (Number.isInteger(userPepperVersion) && userPepperVersion >= 0 && userPepperVersion < peppers.length) {
    start = userPepperVersion;
  }

  const checkIndex = async idx => {
    try { return await argon2.verify(storedHash, (peppers[idx] || '') + prehashedPassword); }
    catch { return false; }
  };

  if (await checkIndex(start)) return start;

  for (let offset = 1; offset < peppers.length; offset++) {
    const newer = start - offset, older = start + offset;
    if (newer >= 0 && await checkIndex(newer)) return newer;
    if (older < peppers.length && await checkIndex(older)) return older;
  }
  return null;
}

async function hashWithCurrentPepper(prehashedPassword, options = argonOptions) {
  const current = getCurrentPepper();
  return await argon2.hash((current || '') + prehashedPassword, options);
}

// ==================== REGISTER USER
const registerUser = async (req, res, next) => {
  const ipAddress = (req.headers['x-forwarded-for'] || req.connection.remoteAddress || '').split(',')[0].trim();
  try {
    const { name, email, password, password2 } = req.body;
    if (!name || !email || !password) return next(new HttpError('Fill in all fields', 422));

    const newEmail = email.toLowerCase();

    try { await limiterSlowBruteByIP.consume(ipAddress); } catch { await sleep(SHADOW_DELAY_BLOCKED); return next(new HttpError('Too many requests', 429)); }

    if (await User.findOne({ email: newEmail })) return next(new HttpError('Email Already Exists!', 422));
    if (password.length < 8) return next(new HttpError('Password should at least be 8 characters!', 422));
    if (password !== password2) return next(new HttpError('Passwords do not match!', 422));

    const prehashedPassword = prehashPassword(password);
    const hashedPass = await hashWithCurrentPepper(prehashedPassword, argonOptions);

    const DEFAULT_AVATAR = 'default-avatar.png';
    const newUser = await User.create({
      name,
      email: newEmail,
      password: hashedPass,
      avatar: DEFAULT_AVATAR,
      pepperVersion: 0,
      ipAddress: [{ ip: ipAddress, lastSeen: Date.now() }]
    });

    await sendEmail(newUser.email, 'Welcome!', `<h4>Welcome to MERn Blog!</h4>`);

    const safeUser = { ...newUser._doc }; delete safeUser.password;
    res.status(201).json({ message: `New User ${newUser.name} registered successfully!`, user: safeUser });

  } catch (error) {
    return next(new HttpError('User registration failed!', 422));
  }
};

// ==================== LOGIN USER
const loginUser = async (req, res, next) => {
  const currentIP = (req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress || '127.0.0.1').trim();
  const { email, password } = req.body;
  try {
    if (!email || !password) return next(new HttpError('Fill in all fields', 422));
    const emailKey = email.toLowerCase();

    if (!isIpWhitelisted(currentIP)) {
      try { await consumeIfNotWhitelisted(currentIP); } catch { await sleep(SHADOW_DELAY_BLOCKED); return next(new HttpError('Too many requests', 429)); }
    }

    const user = await User.findOne({ email: emailKey });
    if (!user) { await sleep(SHADOW_DELAY_FAILED); return next(new HttpError('User Not Found!', 404)); }

    const prehashedPassword = prehashPassword(password);
    const matchedIndex = await verifyPasswordWithPeppers(user.password, prehashedPassword, user.pepperVersion);

    if (matchedIndex === null) {
      user.failedLogins = (user.failedLogins || 0) + 1; await user.save();
      await sleep(SHADOW_DELAY_FAILED); return next(new HttpError('Invalid Credentials!', 401));
    }

    // rehash if old pepper or monthly
    if (matchedIndex !== 0 || needsMonthlyRehash(user.lastPasswordRehash)) {
      const newHash = await hashWithCurrentPepper(prehashedPassword, argonOptionsStrong);
      user.password = newHash;
      user.pepperVersion = 0;
      user.lastPasswordRehash = new Date();
    }

    user.failedLogins = 0;
    const existingIP = user.ipAddress.find(e => e.ip === currentIP);
    if (!existingIP) user.ipAddress.push({ ip: currentIP, lastSeen: new Date() });
    else existingIP.lastSeen = new Date();

    await user.save();
    if (!isIpWhitelisted(currentIP)) await limiterSlowBruteByIP.delete(currentIP);

    const { _id: id, name: userName } = user;
    const token = jwt.sign({ id, name: userName }, process.env.JWT_SECRET, { expiresIn: '6h' });
    res.status(200).json({ token, id, name: userName, posts: user.posts });

  } catch (error) {
    return next(new HttpError('Account could not be found!', 422));
  }
};

// ==================== GET USER
const getUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select('-password');
    if (!user) return next(new HttpError('User not found', 404));
    res.status(200).json(user);
  } catch (error) {
    return next(new HttpError(error));
  }
};

// ==================== CHANGE AVATAR (UPLOAD TO R2)
const changeAvatar = async (req, res, next) => {
  try {
    if (!req.files || !req.files.avatar) return next(new HttpError('No Image was uploaded!', 422));

    const user = await User.findById(req.user.id);
    const { avatar } = req.files;

    if (avatar.size > avatarSizeBytes) return next(new HttpError(`File size exceeds ${avatarSizeMb}`, 422));

    const ext = path.extname(avatar.name);
    const key = `mern/avatars/${uuid()}${ext}`;

    const command = new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET,
      Key: key,
      Body: avatar.data,
      ContentType: avatar.mimetype,
      ACL: 'public-read',
    });

    await s3.send(command);

    // Use your public R2 assets URL
    user.avatar = `${process.env.CLOUDFLARE_R2_ASSETS_URL}/${key}`;
    await user.save();

    res.status(200).json(user);

  } catch (error) {
    return next(new HttpError(error.message || 'Avatar upload failed', 500));
  }
};

// ==================== EDIT USER
const editUser = async (req, res, next) => {
  try {
    const { name, email, about, currentPassword, newPassword, confirmNewPassword } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return next(new HttpError('User not found', 403));

    if (name?.trim()) user.name = name.trim();
    if (email?.trim() && email !== user.email) {
      const existing = await User.findOne({ email: email.trim(), _id: { $ne: req.user.id } });
      if (existing) return next(new HttpError('Email already in use', 422));
      user.email = email.trim();
    }
    if (about?.trim()) user.about = about.trim();

    if (newPassword) {
      if (!currentPassword) return next(new HttpError('Current Password Required', 422));
      const prehashedCurrent = prehashPassword(currentPassword);
      const matchedIndex = await verifyPasswordWithPeppers(user.password, prehashedCurrent, user.pepperVersion);
      if (matchedIndex === null) return next(new HttpError('Current Password is Invalid.', 422));

      if (matchedIndex !== 0) {
        const rehash = await hashWithCurrentPepper(prehashedCurrent, argonOptionsStrong);
        user.password = rehash; user.pepperVersion = 0; user.lastPasswordRehash = new Date();
      }

      if (newPassword !== confirmNewPassword) return next(new HttpError('New passwords do not match.', 422));
      const prehashedNew = prehashPassword(newPassword);
      if (await verifyPasswordWithPeppers(user.password, prehashedNew, user.pepperVersion) !== null)
        return next(new HttpError('Cannot reuse current password.', 422));

      user.password = await hashWithCurrentPepper(prehashedNew, argonOptions);
      user.lastPasswordRehash = new Date();
    }

    await user.save();
    const updatedUser = await User.findById(req.user.id).select('-password');
    sendSSE('profile_updated', updatedUser.toObject());
    res.status(200).json({ message: 'User updated', ...updatedUser.toObject() });

  } catch (error) {
    return next(new HttpError(error.message || 'Edit user failed', 500));
  }
};

// ==================== GET AUTHORS
const getAuthors = async (req, res, next) => {
  try {
    const authors = await User.find().select('-password');
    res.json(authors);
  } catch (error) {
    return next(new HttpError(error));
  }
};

export { registerUser, loginUser, getUser, changeAvatar, editUser, getAuthors };
