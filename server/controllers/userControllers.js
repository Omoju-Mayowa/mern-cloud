import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import path from 'path';
import { v4 as uuid } from 'uuid';
import crypto from 'node:crypto';
import User from '../models/userModel.js';
import { HttpError } from "../models/errorModel.js";
import { sendSSE } from './postControllers.js';
import s3 from '../utils/r2Client.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getPeppers, getCurrentPepper } from '../utils/peppers.js';

const avatarSizeBytes = 10485760; 

const argonOptionsStrong = {
    type: argon2.argon2id,
    memoryCost: 2 ** 17,
    timeCost: 6,
    parallelism: 4,
};

const prehashPassword = password => crypto.createHash('sha256').update(password).digest('hex');

async function verifyPasswordWithPeppers(storedHash, prehashedPassword, userPepperVersion) {
    const peppers = getPeppers();
    const len = peppers.length;
    if (len === 0) return null;
    let start = (Number.isInteger(userPepperVersion) && userPepperVersion < len) ? userPepperVersion : 0;
    const checkIndex = async idx => {
        try { return await argon2.verify(storedHash, (peppers[idx] || '') + prehashedPassword); }
        catch { return false; }
    };
    if (await checkIndex(start)) return start;
    for (let i = 0; i < len; i++) { if (i !== start && await checkIndex(i)) return i; }
    return null;
}

async function hashWithCurrentPepper(prehashedPassword) {
    const current = getCurrentPepper();
    return await argon2.hash((current || '') + prehashedPassword, argonOptionsStrong);
}

export const registerUser = async (req, res, next) => {
    try {
        const { name, email, password, password2 } = req.body;
        if (!name || !email || !password) return next(new HttpError('Fill in all fields', 422));
        if (password !== password2) return next(new HttpError('Passwords match fail', 422));

        const emailKey = email.toLowerCase();
        if (await User.findOne({ email: emailKey })) return next(new HttpError('Email exists', 422));

        const hashedPassword = await hashWithCurrentPepper(prehashPassword(password));
        const newUser = await User.create({
            name, email: emailKey, password: hashedPassword,
            avatar: 'default-avatar.png', pepperVersion: 0
        });
        res.status(201).json({ message: "Registered", id: newUser._id });
    } catch (error) {
        return next(new HttpError('Registration failed', 500));
    }
};

export const loginUser = async (req, res, next) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return next(new HttpError('Invalid credentials', 401));
        const matchedIndex = await verifyPasswordWithPeppers(user.password, prehashPassword(password), user.pepperVersion);
        if (matchedIndex === null) return next(new HttpError('Invalid credentials', 401));

        const token = jwt.sign({ id: user._id, name: user.name }, process.env.JWT_SECRET, { expiresIn: '6h' });
        res.status(200).json({ token, id: user._id, name: user.name });
    } catch (error) {
        return next(new HttpError('Login failed', 500));
    }
};

export const editUser = async (req, res, next) => {
    try {
        const { currentPassword, newPassword, confirmNewPassword } = req.body;
        const user = await User.findById(req.user.id);
        if (newPassword) {
            const matchedIndex = await verifyPasswordWithPeppers(user.password, prehashPassword(currentPassword), user.pepperVersion);
            if (matchedIndex === null) return next(new HttpError('Current password wrong', 422));
            if (newPassword !== confirmNewPassword) return next(new HttpError('New passwords mismatch', 422));
            user.password = await hashWithCurrentPepper(prehashPassword(newPassword));
            user.pepperVersion = 0;
            await user.save();
        }
        res.status(200).json({ message: "Security updated" });
    } catch (error) {
        return next(new HttpError('Security update failed', 500));
    }
};

export const updateUserProfile = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, email } = req.body;
        if (id !== req.user.id) return next(new HttpError('Unauthorized', 403));

        const user = await User.findById(id);
        if (name) user.name = name;
        if (email) user.email = email.toLowerCase();

        if (req.files?.avatar) {
            const { avatar } = req.files;
            if (avatar.size > avatarSizeBytes) return next(new HttpError('File too large', 413));
            
            const relativeKey = `avatars/${uuid()}${path.extname(avatar.name)}`;
            await s3.send(new PutObjectCommand({
                Bucket: process.env.CLOUDFLARE_R2_BUCKET,
                Key: `mern/${relativeKey}`,
                Body: avatar.data,
                ContentType: avatar.mimetype,
            }));
            user.avatar = relativeKey;
        }
        await user.save();
        const updated = await User.findById(id).select('-password');
        sendSSE('profile_updated', updated.toObject());
        res.status(200).json(updated);
    } catch (error) {
        return next(new HttpError(error.message, 500));
    }
};

export const getUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        res.status(200).json(user);
    } catch (error) { next(new HttpError(error)) }
};

export const getAuthors = async (req, res, next) => {
    try {
        const authors = await User.find().select('-password');
        res.json(authors);
    } catch (error) { next(new HttpError(error)) }
};

export const changeAvatar = updateUserProfile;
