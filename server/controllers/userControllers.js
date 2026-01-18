// backend/controllers/userControllers.js

import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import crypto from 'node:crypto';
import path from 'path';
import { PutObjectCommand } from "@aws-sdk/client-s3";

import User from '../models/userModel.js';
import { HttpError } from "../models/errorModel.js";
import { consumeIfNotWhitelisted, isIpWhitelisted, limiterSlowBruteByIP } from '../middleware/loginRateLimiter.js';
import sendEmail from '../utils/sendEmail.js';
import __dirname from '../utils/directory.js';
import { sendSSE } from './postControllers.js';
import s3 from '../utils/r2Client.js';
import { getPeppers, getCurrentPepper } from '../utils/peppers.js';

// ======================== CONSTANTS ========================
const failedLogin = 5;
const avatarSizeBytes = 10485760; // 10MB
const avatarSizeMb = (avatarSizeBytes / (1024 * 1024)).toFixed(2) + 'Mb';
const siteLink = process.env.SITE_LINK;

// Argon2 options
const argonOptions = { type: argon2.argon2id, memoryCost: 2 ** 16, timeCost: 4, parallelism: 2 };
const argonOptionsStrong = { type: argon2.argon2id, memoryCost: 2 ** 17, timeCost: 6, parallelism: 4, version: 0x13 };

// ======================== HELPERS ========================

// Sleep for shadow banning
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Prehash password (SHA-256)
const prehashPassword = (password) => crypto.createHash('sha256').update(password).digest('hex');

// Check if password needs monthly rehash
const needsMonthlyRehash = (lastRehashDate) => {
    if (!lastRehashDate) return true;
    return Date.now() - lastRehashDate.getTime() >= 30 * 24 * 60 * 60 * 1000;
}

// Verify password with peppers
async function verifyPasswordWithPeppers(storedHash, prehashedPassword, userPepperVersion) {
    const peppers = getPeppers();
    if (!peppers.length) return null;

    let start = Number.isInteger(userPepperVersion) && userPepperVersion >= 0 && userPepperVersion < peppers.length ? userPepperVersion : 0;

    const checkIndex = async (idx) => {
        try {
            return await argon2.verify(storedHash, (peppers[idx] || '') + prehashedPassword);
        } catch { return false; }
    }

    if (await checkIndex(start)) return start;

    for (let offset = 1; offset < peppers.length; offset++) {
        if (start - offset >= 0 && await checkIndex(start - offset)) return start - offset;
        if (start + offset < peppers.length && await checkIndex(start + offset)) return start + offset;
    }

    return null;
}

// Hash password with current pepper
async function hashWithCurrentPepper(prehashedPassword, options = argonOptions) {
    const current = getCurrentPepper();
    return await argon2.hash((current || '') + prehashedPassword, options);
}

// Upload file to Cloudflare R2
const uploadToR2 = async (fileBuffer, filename, folder = "mern") => {
    const key = `${folder}/${filename}`;
    const command = new PutObjectCommand({
        Bucket: process.env.CLOUDFLARE_R2_BUCKET,
        Key: key,
        Body: fileBuffer,
        ContentType: "image/jpeg"
    });
    await s3.send(command);
    return `${process.env.CLOUDFLARE_R2_ENDPOINT}/${key}`;
};

// ======================== CONTROLLERS ========================

// Register user
const registerUser = async (req, res, next) => {
    const ipAddress = (req.headers['x-forwarded-for'] || req.connection.remoteAddress || '').split(',')[0].trim();

    try {
        const { name, email, password, password2 } = req.body;
        if (!name || !email || !password) return next(new HttpError('Fill in all fields', 422));

        const newEmail = email.toLowerCase();

        try { await limiterSlowBruteByIP.consume(ipAddress); } catch { await sleep(10000); return next(new HttpError('Too many requests', 429)); }

        if (await User.findOne({ email: newEmail })) return next(new HttpError('Email Already Exists!', 422));

        if (password.trim().length < 8) return next(new HttpError('Password should be at least 8 characters!', 422));
        if (password !== password2) return next(new HttpError('Passwords do not match!', 422));

        const prehashedPassword = prehashPassword(password);
        const hashedPass = await hashWithCurrentPepper(prehashedPassword, argonOptions);

        const DEFAULT_AVATAR = `${process.env.CLOUDFLARE_R2_ENDPOINT}/mern/default-avatar.png`;

        const newUser = await User.create({
            name,
            email: newEmail,
            password: hashedPass,
            avatar: DEFAULT_AVATAR,
            pepperVersion: 0,
            ipAddress: [{ ip: ipAddress, lastSeen: Date.now() }]
        });

        await sendEmail(newUser.email, 'New User Notification', `<h4>Welcome ${newUser.name}!</h4>`);

        const safeUser = { ...newUser._doc };
        delete safeUser.password;

        res.status(201).json({ message: `New User ${newUser.name} registered successfully!`, user: safeUser });
    } catch (error) {
        return next(new HttpError('User registration failed!', 422));
    }
};

// Login user
const loginUser = async (req, res, next) => {
    const currentIP = (req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress || '127.0.0.1').trim();
    const { email, password } = req.body;

    try {
        if (!email || !password) return next(new HttpError('Fill in all fields', 422));

        const emailKey = email.toLowerCase();
        if (!isIpWhitelisted(currentIP)) try { await consumeIfNotWhitelisted(currentIP); } catch { await sleep(10000); return next(new HttpError('Too many requests', 429)); }

        const user = await User.findOne({ email: emailKey });
        if (!user) { await sleep(10); return next(new HttpError('User Not Found!', 404)); }

        const prehashedPassword = prehashPassword(password);
        const matchedIndex = await verifyPasswordWithPeppers(user.password, prehashedPassword, user.pepperVersion);

        if (matchedIndex === null) {
            user.failedLogins = (user.failedLogins || 0) + 1;
            await user.save();
            await sleep(10);
            return next(new HttpError('Invalid Credentials!', 401));
        }

        // Update password if needed
        if (matchedIndex !== 0 || await argon2.needsRehash(user.password) || needsMonthlyRehash(user.lastPasswordRehash)) {
            user.password = await hashWithCurrentPepper(prehashedPassword, argonOptionsStrong);
            user.pepperVersion = 0;
            user.lastPasswordRehash = new Date();
        }

        user.failedLogins = 0;
        await user.save();

        const token = jwt.sign({ id: user._id, name: user.name }, process.env.JWT_SECRET, { expiresIn: '6h' });

        res.status(200).json({ token, id: user._id, name: user.name, posts: user.posts });
    } catch (error) {
        return next(new HttpError('Account could not be found!', 422));
    }
};

// Get user by ID
const getUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) return next(new HttpError("User not found", 404));
        res.status(200).json(user);
    } catch (error) {
        return next(new HttpError(error));
    }
};

// ==================== CHANGE AVATAR (R2)
const changeAvatar = async (req, res, next) => {
    try {
        if (!req.files || !req.files.avatar) return next(new HttpError('No Image was uploaded!', 422));

        const { avatar } = req.files;
        if (avatar.size > avatarSizeBytes) return next(new HttpError(`File size exceeds ${avatarSizeMb}`, 422));

        const ext = path.extname(avatar.name);
        const newFileName = `avatar-${uuid()}${ext}`;
        const publicUrl = await uploadToR2(avatar.data, newFileName);

        const user = await User.findByIdAndUpdate(req.user.id, { avatar: publicUrl }, { new: true }).select('-password');

        res.status(200).json(user);
    } catch (error) {
        return next(new HttpError(error.message || "Failed to update avatar", 500));
    }
};

// ==================== UPDATE USER PROFILE
const updateUserProfile = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, email } = req.body;
        const userId = req.user.id;

        if (id !== userId) return next(new HttpError("You can only update your own profile", 403));

        const user = await User.findById(id);
        if (!user) return next(new HttpError("User not found", 404));

        if (name && name.trim()) user.name = name.trim();
        if (email && email.trim()) {
            const exists = await User.findOne({ email: email.trim(), _id: { $ne: id } });
            if (exists) return next(new HttpError("Email already in use", 422));
            user.email = email.trim();
        }

        if (req.files && req.files.avatar) {
            const { avatar } = req.files;
            if (avatar.size > avatarSizeBytes) return next(new HttpError(`Avatar too large. Max ${avatarSizeMb}`, 422));
            const ext = path.extname(avatar.name);
            const newFileName = `avatar-${uuid()}${ext}`;
            const publicUrl = await uploadToR2(avatar.data, newFileName);
            user.avatar = publicUrl;
        }

        await user.save();
        const updatedUser = await User.findById(id).select('-password');
        sendSSE("profile_updated", updatedUser.toObject());

        res.status(200).json({ message: "Profile updated successfully", ...updatedUser.toObject() });
    } catch (error) {
        return next(new HttpError(error.message || "Failed to update profile", 500));
    }
};

// Get all authors
const getAuthors = async (req, res, next) => {
    try {
        const authors = await User.find().select('-password');
        res.json(authors);
    } catch (error) {
        return next(new HttpError(error));
    }
};

export { registerUser, loginUser, getUser, changeAvatar, updateUserProfile, getAuthors };
