// backend/controllers/userControllers.js
// ? Chose not to use bcrypt since argon is a more secure alternative.
import argon2, { argon2id } from 'argon2';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import crypto from 'node:crypto';
import User from '../models/userModel.js';
import { HttpError } from "../models/errorModel.js";
import { sendSSE } from './postControllers.js';
import { consumeIfNotWhitelisted, isIpWhitelisted, limiterSlowBruteByIP } from '../middleware/loginRateLimiter.js';
import sendEmail from '../utils/sendEmail.js';
import __dirname from '../utils/directory.js';
import s3 from '../utils/r2Client.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getPeppers, getCurrentPepper, getPepperByIndex } from '../utils/peppers.js';

// Site Link Variable
const siteLink = process.env.SITE_LINK;

// Avatar limits
const avatarSizeBytes = 10485760; // 10MB
const avatarSizeMb = (avatarSizeBytes / (1024 * 1024)).toFixed(2) + 'Mb';

// Shadow delays for blocked/failed logins
const SHADOW_DELAY_BLOCKED = 10 * 1000;
const SHADOW_DELAY_FAILED = 0.01 * 1000;
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

// Helper functions
const sleep = ms => new Promise(r => setTimeout(r, ms));
const prehashPassword = password => crypto.createHash('sha256').update(password).digest('hex');

const needsRehash = async hash => await argon2.needsRehash(hash, argonOptionsStrong);

const needsMonthlyRehash = lastRehashDate => {
    if (!lastRehashDate) return true;
    const rehashPeriod = 30 * 24 * 60 * 60 * 1000; // 30 days
    return Date.now() - lastRehashDate.getTime() >= rehashPeriod;
};

// Pepper verification helper
async function verifyPasswordWithPeppers(storedHash, prehashedPassword, userPepperVersion) {
    const peppers = getPeppers();
    const len = peppers.length;
    if (len === 0) return null;

    let start = 0;
    if (Number.isInteger(userPepperVersion) && userPepperVersion >= 0 && userPepperVersion < len) {
        start = userPepperVersion;
    }

    const checkIndex = async idx => {
        try { return await argon2.verify(storedHash, (peppers[idx] || '') + prehashedPassword); }
        catch { return false; }
    };

    if (await checkIndex(start)) return start;

    for (let offset = 1; offset < len; offset++) {
        const newerIdx = start - offset;
        const olderIdx = start + offset;

        if (newerIdx >= 0 && await checkIndex(newerIdx)) return newerIdx;
        if (olderIdx < len && await checkIndex(olderIdx)) return olderIdx;
    }
    return null;
}

// Hash helper that always uses current pepper
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

        const emailExists = await User.findOne({ email: newEmail });
        if (emailExists) { await sleep(SHADOW_DELAY_FAILED); return next(new HttpError('Email Already Exists!', 422)); }

        if ((password.trim()).length < 8) return next(new HttpError('Password should at least be 8 characters!', 422));
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

        await sendEmail(
            newUser.email,
            'New User Notification',
            `<h4>Mern Blog Welcomes You!</h4>
             <p>Welcome to Mern Blog!</p>
             <p>We are so happy to have you here!</p>`
        );

        const safeUser = { ...newUser._doc };
        delete safeUser.password;
        return res.status(201).json({ message: `New User ${newUser.name} registered successfully!`, user: safeUser });
    } catch (error) {
        console.error('Registration Error:', error);
        return next(new HttpError('User registration failed!', 422));
    }
};

// ==================== LOGIN USER
const loginUser = async (req, res, next) => {
    const currentIP = (req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress || '127.0.0.1').trim();
    const { email, password } = req.body;
    console.log('Login attempt:', { email, ip: currentIP });

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

        if (matchedIndex !== null) {
            if (matchedIndex !== 0) {
                try {
                    const newHash = await hashWithCurrentPepper(prehashedPassword, argonOptionsStrong);
                    user.password = newHash;
                    user.pepperVersion = 0;
                    user.lastPasswordRehash = new Date();
                    await user.save();
                } catch { }
            }
        } else {
            user.failedLogins = (user.failedLogins || 0) + 1;
            await user.save();

            if (!isIpWhitelisted(currentIP) && user.failedLogins >= failedLogin) {
                try {
                    await sendEmail(
                        user.email,
                        'Suspicious Login Attempt Detected!',
                        `<div style="font-family: Arial, sans-serif; background: #f8f8f8; padding: 20px; border-radius: 10px; color: #333;">
                            <div style="margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 20px;">
                            <h2 style="color: #d32f2f; text-align: center;">Suspicious Login Attempt Detected</h2>
                            <p>Hello <strong>${user.name}</strong>,</p>
                            <p>Someone tried to log in to your account multiple times from IP: <span style="font-weight:bold; color:#1565c0;">${currentIP}</span>.</p>
                            <p>If this wasn't you, we recommend you change your password immediately.</p>
                            <hr style="border:none; margin:20px 0;">
                            <a href="${siteLink}/forgotPassword" style="color:#fff; text-decoration:none; background:#000; font-weight:bold; padding:1rem;">Change your password here.</a>
                            <hr style="border:none; margin:50px 0;">
                            <p style="font-size:12px; color:#888; text-align:center;">This is an automated security alert from <strong>MERnBlog Security</strong>. Do not reply.</p>
                            </div>
                        </div>`
                    );
                    user.failedLogins = 0;
                    await user.save();
                } catch { }
            }
            await sleep(SHADOW_DELAY_FAILED);
            return next(new HttpError('Invalid Credentials!', 401));
        }

        user.failedLogins = 0;

        try {
            const pepperMismatch = (matchedIndex !== 0);
            const argonNeeds = await needsRehash(user.password);
            const monthlyNeeds = needsMonthlyRehash(user.lastPasswordRehash);

            if (pepperMismatch || argonNeeds || monthlyNeeds) {
                const newHash = await hashWithCurrentPepper(prehashedPassword, argonOptionsStrong);
                user.password = newHash;
                user.lastPasswordRehash = new Date();
            }
        } catch { }

        const existingIP = user.ipAddress.find(entry => entry.ip === currentIP);
        if (!existingIP) user.ipAddress.push({ ip: currentIP, lastSeen: new Date() });
        else existingIP.lastSeen = new Date();

        await user.save();
        if (!isIpWhitelisted(currentIP)) await limiterSlowBruteByIP.delete(currentIP);

        const { _id: id, name: userName } = user;
        const token = jwt.sign({ id, name: userName }, process.env.JWT_SECRET, { expiresIn: '6h' });
        const posts = user.posts;
        res.status(200).json({ token, id, name: userName, posts });
    } catch (error) {
        console.error('Login error:', error);
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
        if (!req.files || !req.files.avatar) return next(new HttpError('No Image uploaded!', 422));
        const user = await User.findById(req.user.id);

        const { avatar } = req.files;
        if (avatar.size > avatarSizeBytes) return next(new HttpError(`File size exceeds ${avatarSizeMb}`, 422));

        // Generate unique filename
        let fileName = avatar.name;
        let ext = fileName.split('.').pop();
        let newFileName = `avatar-${uuid()}.${ext}`;

        // Upload to R2
        const key = `avatars/${newFileName}`;
        const command = new PutObjectCommand({
            Bucket: process.env.CLOUDFLARE_R2_BUCKET,
            Key: key,
            Body: avatar.data,
            ContentType: avatar.mimetype,
            ACL: 'public-read'
        });
        await s3.send(command);
        const fileUrl = `${process.env.CLOUDFLARE_R2_ENDPOINT}/${key}`;

        user.avatar = fileUrl;
        await user.save();
        res.status(200).json(user);
    } catch (err) {
        console.error('Avatar upload failed:', err);
        return next(new HttpError(err.message || 'Failed to change avatar', 500));
    }
};

// ==================== EDIT USER
const editUser = async (req, res, next) => {
    try {
        const { name, email, about, currentPassword, newPassword, confirmNewPassword } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) return next(new HttpError('User not found', 403));

        const updatedName = name?.trim() || user.name;
        const updatedEmail = email?.trim() || user.email;
        const updatedAbout = about?.trim() || user.about;

        if (updatedEmail !== user.email) {
            const existingUser = await User.findOne({ email: updatedEmail, _id: { $ne: req.user.id } });
            if (existingUser) return next(new HttpError('Email already in use', 422));
        }

        let passwordWasUpdated = false;
        if (newPassword) {
            if (!currentPassword) return next(new HttpError('Current Password Required to Change Password', 422));
            const prehashedCurrentPassword = prehashPassword(currentPassword);
            const matchedIndexForCurrent = await verifyPasswordWithPeppers(user.password, prehashedCurrentPassword, user.pepperVersion);
            if (matchedIndexForCurrent === null) return next(new HttpError('Current Password is Invalid.', 422));

            if (matchedIndexForCurrent !== 0) {
                try {
                    const rehash = await hashWithCurrentPepper(prehashedCurrentPassword, argonOptionsStrong);
                    user.password = rehash;
                    user.pepperVersion = 0;
                    user.lastPasswordRehash = new Date();
                    await user.save();
                } catch { }
            }

            if (newPassword !== confirmNewPassword) return next(new HttpError('New passwords do not match.', 422));
            const prehashedNewPassword = prehashPassword(newPassword);
            if ((await verifyPasswordWithPeppers(user.password, prehashedNewPassword, user.pepperVersion)) !== null) return next(new HttpError('Cannot reuse current password.', 422));

            const hashedPassword = await hashWithCurrentPepper(prehashedNewPassword, argonOptions);
            user.password = hashedPassword;
            user.lastPasswordRehash = new Date();
            passwordWasUpdated = true;
        }

        user.name = updatedName;
        user.email = updatedEmail;
        user.about = updatedAbout;
        await user.save();

        const newInfo = await User.findById(req.user.id).select('-password');
        sendSSE('profile_updated', newInfo.toObject());
        res.status(200).json({ message: `User ${newInfo.id} successfully updated!`, ...newInfo.toObject() });
    } catch (error) {
        return next(new HttpError(error));
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

// ==================== UPDATE USER PROFILE (NAME/EMAIL/AVATAR)
const updateUserProfile = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, email } = req.body;
        if (id !== req.user.id) return next(new HttpError('Unauthorized', 403));

        const user = await User.findById(id);
        if (!user) return next(new HttpError('User not found', 404));

        if (name) user.name = name;
        if (email) user.email = email;

        if (req.files && req.files.avatar) {
            const { avatar } = req.files;
            if (avatar.size > 5242880) return next(new HttpError('Avatar too large', 413));

            const ext = path.extname(avatar.name);
            const key = `avatars/${uuid()}${ext}`;

            await s3.send(new PutObjectCommand({
                Bucket: process.env.CLOUDFLARE_R2_BUCKET,
                Key: key,
                Body: avatar.data,
                ContentType: avatar.mimetype
            }));

            // FIXED: Use ASSETS URL instead of ENDPOINT URL
            user.avatar = `${process.env.CLOUDFLARE_R2_ASSETS_URL}/${key}`;
        }

        await user.save();
        const updatedUser = await User.findById(id).select('-password');
        sendSSE('profile_updated', updatedUser.toObject());
        res.status(200).json(updatedUser);
    } catch (error) {
        return next(new HttpError(error.message, 500));
    }
};
export { registerUser, loginUser, getUser, changeAvatar, editUser, updateUserProfile, getAuthors };
