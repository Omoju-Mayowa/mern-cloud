import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuid } from 'uuid';
import fs from 'fs';
import path from 'path';
import User from '../models/userModel.js';
import { HttpError } from "../models/errorModel.js";
import { sendSSE } from './postControllers.js';
import { s3Client, R2_BUCKET, uploadToR2, deleteFromR2 } from '../utils/r2Client.js';
import { consumeIfNotWhitelisted, isIpWhitelisted, limiterSlowBruteByIP } from '../middleware/loginRateLimiter.js';
import sendEmail from '../utils/sendEmail.js';

const avatarSizeBytes = 10 * 1024 * 1024; // 10MB
const avatarSizeMb = (avatarSizeBytes / (1024 * 1024)).toFixed(2) + 'Mb';
const siteLink = process.env.SITE_LINK;
const failedLogin = 5;
const SHADOW_DELAY_BLOCKED = 10 * 1000;
const SHADOW_DELAY_FAILED = 10; // 10ms for failed attempts

// ================= REGISTER NEW USER
const registerUser = async (req, res, next) => {
    const ipAddress = (req.headers['x-forwarded-for'] || req.connection.remoteAddress || '').split(',')[0].trim();
    try {
        const { name, email, password, password2 } = req.body;
        if (!name || !email || !password || !password2) return next(new HttpError('Fill in all fields', 422));
        if (password !== password2) return next(new HttpError('Passwords do not match', 422));
        if (password.length < 8) return next(new HttpError('Password should be at least 8 characters', 422));

        const newEmail = email.toLowerCase();

        // Rate limit
        try { await limiterSlowBruteByIP.consume(ipAddress); } 
        catch { await new Promise(r => setTimeout(r, SHADOW_DELAY_BLOCKED)); return next(new HttpError('Too many requests', 429)); }

        const emailExists = await User.findOne({ email: newEmail });
        if (emailExists) return next(new HttpError('Email already exists', 422));

        const prehashed = prehashPassword(password);
        const hashedPass = await hashWithCurrentPepper(prehashed);

        const DEFAULT_AVATAR = 'default-avatar.png';
        const newUser = await User.create({
            name, email: newEmail, password: hashedPass,
            avatar: DEFAULT_AVATAR, pepperVersion: 0,
            ipAddress: [{ ip: ipAddress, lastSeen: Date.now() }]
        });

        await sendEmail(
            newUser.email,
            'Welcome to Mern Blog!',
            `<p>Hello ${newUser.name}, welcome to Mern Blog!</p>`
        );

        const safeUser = { ...newUser._doc };
        delete safeUser.password;

        res.status(201).json({ message: `User ${newUser.name} registered successfully`, user: safeUser });
    } catch (err) {
        console.error('Registration Error:', err);
        next(new HttpError('User registration failed', 422));
    }
};

// ================= LOGIN USER
const loginUser = async (req, res, next) => {
    const currentIP = (req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress || '127.0.0.1').trim();
    const { email, password } = req.body;

    try {
        if (!email || !password) return next(new HttpError('Fill in all fields', 422));
        const emailKey = email.toLowerCase();

        if (!isIpWhitelisted(currentIP)) {
            try { await consumeIfNotWhitelisted(currentIP); } 
            catch { await new Promise(r => setTimeout(r, SHADOW_DELAY_BLOCKED)); return next(new HttpError('Too many requests', 429)); }
        }

        const user = await User.findOne({ email: emailKey });
        if (!user) return next(new HttpError('User not found', 404));

        const prehashed = prehashPassword(password);
        const matchedIndex = await verifyPasswordWithPeppers(user.password, prehashed, user.pepperVersion);

        if (matchedIndex === null) {
            user.failedLogins = (user.failedLogins || 0) + 1;
            await user.save();
            if (!isIpWhitelisted(currentIP) && user.failedLogins >= failedLogin) {
                await sendEmail(user.email, 'Suspicious Login Attempt', `<p>Login attempt from IP: ${currentIP}</p>`);
                user.failedLogins = 0;
                await user.save();
            }
            return next(new HttpError('Invalid credentials', 401));
        }

        if (matchedIndex !== 0) {
            const newHash = await hashWithCurrentPepper(prehashed);
            user.password = newHash;
            user.pepperVersion = 0;
            user.lastPasswordRehash = new Date();
        }

        user.failedLogins = 0;
        const existingIP = user.ipAddress.find(entry => entry.ip === currentIP);
        if (existingIP) existingIP.lastSeen = new Date();
        else user.ipAddress.push({ ip: currentIP, lastSeen: new Date() });

        await user.save();
        if (!isIpWhitelisted(currentIP)) await limiterSlowBruteByIP.delete(currentIP);

        const token = jwt.sign({ id: user._id, name: user.name }, process.env.JWT_SECRET, { expiresIn: '6h' });
        res.status(200).json({ token, id: user._id, name: user.name, posts: user.posts });
    } catch (err) {
        console.error('Login error:', err);
        next(new HttpError('Account could not be found', 422));
    }
};

// ================= GET USER PROFILE
const getUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) return next(new HttpError('User not found', 404));
        res.status(200).json(user);
    } catch (err) { next(new HttpError(err)) }
};

// ================= CHANGE AVATAR (R2)
const changeAvatar = async (req, res, next) => {
    try {
        if (!req.files?.avatar) return next(new HttpError('No image uploaded', 422));
        const user = await User.findById(req.user.id);
        if (!user) return next(new HttpError('User not found', 404));

        if (user.avatar && !user.avatar.includes('default-avatar.png')) {
            await deleteFromR2(user.avatar);
        }

        if (req.files.avatar.size > avatarSizeBytes) return next(new HttpError(`Avatar exceeds ${avatarSizeMb}`, 413));

        const avatarUrl = await uploadToR2(req.files.avatar, 'avatar');
        user.avatar = avatarUrl;
        await user.save();

        sendSSE('profile_updated', await User.findById(req.user.id).select('-password'));
        res.status(200).json({ message: 'Avatar updated', avatar: avatarUrl });
    } catch (err) { next(new HttpError(err.message || 'Failed to update avatar', 500)); }
};

// ================= EDIT USER DETAILS
const editUser = async (req, res, next) => {
    try {
        const { name, email, about, currentPassword, newPassword, confirmNewPassword } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) return next(new HttpError('User not found', 403));

        if (email && email !== user.email) {
            const exists = await User.findOne({ email, _id: { $ne: req.user.id } });
            if (exists) return next(new HttpError('Email already in use', 422));
            user.email = email.trim();
        }
        if (name) user.name = name.trim();
        if (about) user.about = about.trim();

        if (newPassword) {
            if (!currentPassword) return next(new HttpError('Current password required', 422));
            const preCurrent = prehashPassword(currentPassword);
            const matchedIndex = await verifyPasswordWithPeppers(user.password, preCurrent, user.pepperVersion);
            if (matchedIndex === null) return next(new HttpError('Current password invalid', 422));

            const preNew = prehashPassword(newPassword);
            if ((await verifyPasswordWithPeppers(user.password, preNew, user.pepperVersion)) !== null)
                return next(new HttpError('Cannot reuse current password', 422));
            if (newPassword !== confirmNewPassword) return next(new HttpError('New passwords do not match', 422));

            user.password = await hashWithCurrentPepper(preNew);
            user.lastPasswordRehash = new Date();
            user.pepperVersion = 0;
        }

        await user.save();
        const updatedUser = await User.findById(req.user.id).select('-password');
        sendSSE('profile_updated', updatedUser.toObject());
        res.status(200).json({ message: 'User updated successfully', ...updatedUser.toObject() });
    } catch (err) { next(new HttpError(err.message || 'Failed to edit user', 500)); }
};

// ================= GET ALL AUTHORS
const getAuthors = async (req, res, next) => {
    try {
        const authors = await User.find().select('-password');
        res.status(200).json(authors);
    } catch (err) { next(new HttpError(err)); }
};

// ================= UPDATE USER PROFILE (simple updates + avatar)
const updateUserProfile = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (id !== req.user.id) return next(new HttpError('You can only update your own profile', 403));

        const user = await User.findById(id);
        if (!user) return next(new HttpError('User not found', 404));

        if (req.body.name) user.name = req.body.name.trim();
        if (req.body.email) {
            const exists = await User.findOne({ email: req.body.email.trim(), _id: { $ne: id } });
            if (exists) return next(new HttpError('Email already in use', 422));
            user.email = req.body.email.trim();
        }

        if (req.files?.avatar) {
            const avatar = req.files.avatar;
            if (avatar.size > avatarSizeBytes) return next(new HttpError(`Avatar exceeds ${avatarSizeMb}`, 413));

            if (user.avatar && !user.avatar.includes('default-avatar.png')) {
                await deleteFromR2(user.avatar);
            }

            const avatarUrl = await uploadToR2(avatar, 'avatar');
            user.avatar = avatarUrl;
        }

        await user.save();
        const updatedUser = await User.findById(id).select('-password');
        sendSSE('profile_updated', updatedUser.toObject());
        res.status(200).json({ message: 'Profile updated successfully', ...updatedUser.toObject() });
    } catch (err) { next(new HttpError(err.message || 'Failed to update profile', 500)); }
};

export { registerUser, loginUser, getUser, changeAvatar, editUser, getAuthors, updateUserProfile };
