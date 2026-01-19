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

// Moderate Argon settings to balance security and Railway CPU limits
const argonOptionsStrong = {
    type: argon2.argon2id,
    memoryCost: 2 ** 17, 
    timeCost: 6,
    parallelism: 4,
};

/**
 * Pre-hashes the password using SHA256 before passing to Argon2.
 * This ensures a consistent input length and adds a baseline layer of hashing.
 */
const prehashPassword = password => crypto.createHash('sha256').update(password).digest('hex');

/**
 * OPTIMIZED VERIFICATION
 * 1. Checks the stored pepper version first (Fast Path).
 * 2. Checks a limited number of recent peppers if the first fails (Recovery Path).
 */
async function verifyPasswordWithPeppers(storedHash, prehashedPassword, userPepperVersion) {
    const peppers = getPeppers();
    const len = peppers.length;
    if (len === 0) return null;

    // --- 1. FAST PATH ---
    // Try the version recorded in MongoDB. This takes ~1s.
    const start = (Number.isInteger(userPepperVersion) && userPepperVersion >= 0 && userPepperVersion < len) ? userPepperVersion : 0;
    
    try {
        const isMatch = await argon2.verify(storedHash, (peppers[start] || '') + prehashedPassword);
        if (isMatch) return start;
    } catch (err) {
        console.error("Argon verify error on fast path", err);
    }

    // --- 2. LIMITED RECOVERY PATH ---
    // Check the 3 most recent peppers as fallback. Prevents the 1.3min loop.
    const lookbackLimit = 3; 
    const startIndex = Math.max(0, len - lookbackLimit);

    for (let i = len - 1; i >= startIndex; i--) {
        if (i === start) continue; 
        try {
            const isMatch = await argon2.verify(storedHash, (peppers[i] || '') + prehashedPassword);
            if (isMatch) return i;
        } catch {
            continue;
        }
    }
    
    return null; 
}

/**
 * Generates a new Argon2 hash using the most recent pepper in the JSON file.
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

// --- CONTROLLERS ---

export const registerUser = async (req, res, next) => {
    try {
        const { name, email, password, password2 } = req.body;
        if (!name || !email || !password) return next(new HttpError('Fill in all fields', 422));
        if (password !== password2) return next(new HttpError('Passwords match fail', 422));

        const emailKey = email.toLowerCase();
        if (await User.findOne({ email: emailKey })) return next(new HttpError('Email exists', 422));

        const { hash, version } = await hashWithCurrentPepper(prehashPassword(password));
        
        const newUser = await User.create({
            name, 
            email: emailKey, 
            password: hash,
            avatar: 'default-avatar.png', 
            pepperVersion: version
        });
        
        res.status(201).json({ message: "Registered", id: newUser._id });
    } catch (error) {
        console.error("Registration error:", error);
        return next(new HttpError('Registration failed', 500));
    }
};



export const loginUser = async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return next(new HttpError("Please fill in all fields.", 422));
    }

    try {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return next(new HttpError('Invalid credentials', 401));

        const prehashed = prehashPassword(password);
        
        // Verify the password
        const matchedIndex = await verifyPasswordWithPeppers(
            user.password, 
            prehashed, 
            user.pepperVersion
        );

        if (matchedIndex === null || matchedIndex === undefined) {
            return next(new HttpError('Invalid credentials', 401));
        }

        // --- AUTOMATIC SECURITY UPGRADE ---
        // If the password matches but isn't using the latest pepper, upgrade it now.
        const peppers = getPeppers();
        const latestVersion = peppers.length - 1;

        if (matchedIndex !== latestVersion) {
            const { hash, version } = await hashWithCurrentPepper(prehashed);
            await User.findByIdAndUpdate(user._id, { 
                password: hash, 
                pepperVersion: version 
            });
            console.log(`User ${user.email} security upgraded to latest pepper index: ${version}`);
        }

        const token = jwt.sign(
            { id: user._id, name: user.name }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1m' }
        );

        res.status(200).json({ 
            token, 
            id: user._id, 
            name: user.name,
            avatar: user.avatar 
        });

    } catch (error) {
        console.error("Login Controller Error:", error);
        return next(new HttpError('Login failed. Please try again later.', 500));
    }
};

export const editUser = async (req, res, next) => {
    try {
        const { currentPassword, newPassword, confirmNewPassword } = req.body;
        const user = await User.findById(req.user.id);
        
        if (newPassword) {
            const matchedIndex = await verifyPasswordWithPeppers(
                user.password, 
                prehashPassword(currentPassword), 
                user.pepperVersion
            );
            
            if (matchedIndex === null) return next(new HttpError('Current password wrong', 422));
            if (newPassword !== confirmNewPassword) return next(new HttpError('New passwords mismatch', 422));
            
            const { hash, version } = await hashWithCurrentPepper(prehashPassword(newPassword));
            user.password = hash;
            user.pepperVersion = version;
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
