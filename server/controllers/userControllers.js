// ? Chose not to use bcrypt since argon is a more secure alternative.
import argon2, { argon2id } from 'argon2'
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import {v4 as uuid} from 'uuid';
import { consumeIfNotWhitelisted, isIpWhitelisted, limiterSlowBruteByIP, redisClient } from '../middleware/loginRateLimiter.js';
import sendEmail from '../utils/sendEmail.js';
import __dirname from '../utils/directory.js'
import crypto from 'node:crypto';

// Site Link Variable.
// ! Data stored in env file
const siteLink = process.env.SITE_LINK;

import User from '../models/userModel.js'
import { HttpError } from "../models/errorModel.js"
import { version } from 'os';
import { sendSSE } from './postControllers.js';

// Not Being Used at the moment
// import { request } from 'http'
// import { memoryUsage } from 'process';


const sleep = ms => new Promise(r => setTimeout(r, ms))
// Number of Failed Login before trigger
const failedLogin = 5


// * Size of Profile Pic / Avatar
const avatarSizeBytes = 10485760; // Currently 10MB
const avatarSizeMb = (avatarSizeBytes / ( 1024 * 1024 )).toFixed(2) + 'Mb'

const SHADOW_DELAY_BLOCKED = 10 * 1000 //* Blocked IP for 10 seconds, might also reduce response time
const SHADOW_DELAY_FAILED = 0.01 * 1000 //* short 1000ms or 1 second for normal failed attempt

// ! Argon Options
const argonOptions = {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 4,
    parallelism: 2,
}
// Argon Rehash Options
const argonOptionsStrong = {
    type: argon2.argon2id,
    memoryCost: 2 ** 17,
    timeCost: 6,
    parallelism: 4,
    version: 0x13
}

// ? needsrehash Helper
const needsRehash = async (hash) => {
    return await argon2.needsRehash(hash, argonOptionsStrong)
}

// ? Monthly Rehash Password Helper
const needsMonthlyRehash = (lastRehashDate) => {
    if (!lastRehashDate) return true;
    const rehashPeriod = 30 * 24 * 60 * 60 * 1000; // Rehash Period
    return Date.now() - lastRehashDate.getTime() >= rehashPeriod;
}

// ? Prehash Password Helper
const prehashPassword = (password) => {
    return crypto
        .createHash('sha256')
        .update(password)
        .digest('hex');
    }

import { getPeppers, getCurrentPepper, getPepperByIndex } from '../utils/peppers.js'

/**
 * Efficient indexed pepper verification for large pepper arrays.
 * Returns the index of the matching pepper or null if none matched.
 * The search starts at the user's recorded pepper index (if valid) and
 * expands outward (closer indices first). This minimizes the number of
 * expensive argon2.verify() calls for users who are "near" the latest.
 */
async function verifyPasswordWithPeppers(storedHash, prehashedPassword, userPepperVersion) {
    const peppers = getPeppers();
    const len = peppers.length;
    if (len === 0) return null;

    // Validate start index; default to 0 (current) if missing/invalid
    let start = 0;
    if (Number.isInteger(userPepperVersion) && userPepperVersion >= 0 && userPepperVersion < len) {
        start = userPepperVersion;
    }

    // Helper to check a single index
    const checkIndex = async (idx) => {
        try {
            return await argon2.verify(storedHash, (peppers[idx] || '') + prehashedPassword);
        } catch (err) {
            // argon2.verify will throw on invalid hash format; treat as non-match
            return false;
        }
    }

    // First try the user's recorded index
    if (await checkIndex(start)) return start;

    // Expand search outward from start (check closer indices first).
    for (let offset = 1; offset < len; offset++) {
        const newerIdx = start - offset; // closer to 0 -> newer
        const olderIdx = start + offset; // farther -> older

        if (newerIdx >= 0) {
            if (await checkIndex(newerIdx)) return newerIdx;
        }
        if (olderIdx < len) {
            if (await checkIndex(olderIdx)) return olderIdx;
        }
    }

    // No pepper matched
    return null;
}

// ? Hash helper that always uses the current pepper (index 0)
async function hashWithCurrentPepper(prehashedPassword, options = argonOptions) {
  const current = getCurrentPepper();
  return await argon2.hash((current || '') + prehashedPassword, options);
}

// * ==================== REGISTER NEW USER
// * POST: api/users/registerzs
// * UNPROTECTED
const registerUser = async (req, res, next) => {
    // Not necessary anymore, use to test if routes work
    // res.json("Register User")
    const ipAddress = (req.headers['x-forwarded-for'] || req.connection.remoteAddress || '').split(',')[0].trim();

    
    try {
        const {name, email, password, password2} = req.body;
        if(!name || !email || !password) {
            return next(new HttpError('Fill in all fields', 422))
        }

        // Chages email to lowercase for convenience
        const newEmail = email.toLowerCase();

        // * Ip Blocking Implemented Here
        try {
            await limiterSlowBruteByIP.consume(ipAddress);
        } catch (ipBlocked) {
            console.warn('Shadow Ban: IP Blocked', { IP: ipAddress, info: ipBlocked });
            await sleep(SHADOW_DELAY_BLOCKED);
            return next(new HttpError('Too many requests, try again later', 429));
        }


        // Check if Email Exists within Database
        const emailExists = await User.findOne({email: newEmail})
        if(emailExists) {
            try {
                await limiterSlowBruteByIP.consume(ipAddress);
            } catch (ipBlocked) {
                console.warn('Shadow Ban: IP Blocked', { IP: ipAddress, info: ipBlocked });
                await sleep(SHADOW_DELAY_BLOCKED);
                return next(new HttpError('Too many requests, try again later', 429));
            }
    
            return next(new HttpError('Email Already Exists!', 422))
        }

        // Checking Password Length
        if((password.trim()).length < 8) {
            return next(new HttpError('Password should at least be 8 characters!', 422))
        }

        if(password != password2) {
            return next(new HttpError('Passwords do not match!', 422))
        }
        
        // * Password Hashing occurs here
        const prehashedPassword = prehashPassword(password);
        const hashedPass = await hashWithCurrentPepper(prehashedPassword, argonOptions)

        // Assign a default avatar so users who don't upload one don't show 'undefined'
        const DEFAULT_AVATAR = 'default-avatar.png'
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
    // Do not leak password hash in response — return a safe user object
    const safeUser = { ...newUser._doc }
    delete safeUser.password

    return res.status(201).json({ message: `New User ${newUser.name} registered successfully!`, user: safeUser })

    } catch (error) {
        console.log('Registration Error:', error)
        return next(new HttpError('User registration failed!', 422))
    }

}













// * ==================== LOGIN REGISTERED USER
// * POST: api/users/login
// * UNPROTECTED
const loginUser = async (req, res, next) => {
    const currentIP = (req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress || '127.0.0.1').trim();
    const { email, password } = req.body;

    console.log('Login attempt:', { email, ip: currentIP });

    try {
        if (!email || !password) {
            return next(new HttpError('Fill in all fields', 422));
        }

        const emailKey = email.toLowerCase();
        
        // Only apply rate limiting for non-whitelisted IPs
        if (!isIpWhitelisted(currentIP)) {
            try {
                await consumeIfNotWhitelisted(currentIP);
            } catch (ipBlocked) {
                console.warn('Shadow Ban: IP Blocked', { IP: currentIP, info: ipBlocked });
                await sleep(SHADOW_DELAY_BLOCKED);
                return next(new HttpError('Too many requests, try again later', 429));
            }
        }


        const user = await User.findOne({ email: emailKey });
        if (!user) {
            await sleep(SHADOW_DELAY_FAILED);
            return next(new HttpError(`User Not Found!`, 404));
        }

        // Password check
        const prehashedPassword = prehashPassword(password);
        const matchedIndex = await verifyPasswordWithPeppers(user.password, prehashedPassword, user.pepperVersion);

        if (matchedIndex !== null) {
            // If logged in with an old pepper index, upgrade to current (index 0) and rehash
            if (matchedIndex !== 0) {
                try {
                    const newHash = await hashWithCurrentPepper(prehashedPassword, argonOptionsStrong);
                    user.password = newHash;
                    user.pepperVersion = 0;
                    user.lastPasswordRehash = new Date();
                    await user.save();
                } catch (rehashErr) {
                    console.error('Failed to rehash password on login:', rehashErr);
                    // don't block the login — continue with verified credentials
                }
            }
        } else {
            user.failedLogins = (user.failedLogins || 0) + 1;
            await user.save();

            // ! Only send security emails for non-whitelisted IPs
            if (!isIpWhitelisted(currentIP) && user.failedLogins >= failedLogin) {
                try {
                    await sendEmail(
                        user.email,
                        'Suspicious Login Attempt Detected!',
                        `<div style="font-family: Arial, sans-serif; background: #f8f8f8; padding: 20px; border-radius: 10px; color: #333;">
                            <div style="margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 20px; ">
                            <h2 style="color: #d32f2f; text-align: center;">Suspicious Login Attempt Detected</h2>
                            <p>Hello <strong>${user.name}</strong>,</p>
                            <p>Someone tried to log in to your account multiple times from IP: 
                                <span style="font-weight:bold; color:#1565c0;">${currentIP}</span>.
                            </p>
                            <p>If this wasn't you, we recommend you change your password immediately.</p>
                            <hr style="border:none; margin:20px 0;">
                            <a href="${siteLink}/forgotPassword" style="color:#fff; text-decoration:none; background: #000; font-weight:bold; padding: 1rem;">Change your password here.</a>
                            <hr style="border:none; margin:50px 0;">
                            <p style="font-size: 12px; color: #888; text-align: center;">
                                This is an automated security alert from <strong>MERnBlog Security</strong>. Please do not reply.
                            </p>
                            </div>
                        </div>`
                    );
                    user.failedLogins = 0;
                    await user.save();
                } catch (err) {
                    console.error('Failed to send alert email:', err);
                }
            }

            await sleep(SHADOW_DELAY_FAILED);
            return next(new HttpError(`Invalid Credentials!`, 401));
        }

        // * Successful login
        user.failedLogins = 0;

        //* Check if password needs rehash
        try {
            //* Rehash if:
            //* 1) password was verified with an old pepper index, or
            //* 2) argon2 reports needsRehash, or
            //* 3) monthly rotation period reached
            const pepperMismatch = (typeof matchedIndex === 'number' && matchedIndex !== 0);
            const argonNeeds = await needsRehash(user.password);
            const monthlyNeeds = needsMonthlyRehash(user.lastPasswordRehash);

            if (pepperMismatch || argonNeeds || monthlyNeeds) {
                console.log('Updating password hash (pepper/params rotation).', { pepperMismatch, argonNeeds, monthlyNeeds });
                const newHash = await hashWithCurrentPepper(prehashedPassword, argonOptionsStrong);
                user.password = newHash;
                user.lastPasswordRehash = new Date();
            }
        } catch (rehashError) {
            console.error('Password rehash failed', rehashError);
        }

        // Update IP addresses
        const existingIP = user.ipAddress.find(entry => entry.ip === currentIP);
        if (!existingIP) {
            user.ipAddress.push({ ip: currentIP, lastSeen: new Date() });
        } else {
            existingIP.lastSeen = new Date();
        }

        await user.save();

        // Clear rate limiter for successful login
        if (!isIpWhitelisted(currentIP)) {
            await limiterSlowBruteByIP.delete(currentIP);
        }

        // Issue JWT token
        const { _id: id, name } = user;
        const token = jwt.sign({ id, name }, process.env.JWT_SECRET, { expiresIn: '6h' });

        const posts = user.posts
        res.status(200).json({ token, id, name, posts });
    } catch (error) {
        console.error('Login error:', error);
        return next(new HttpError('Account could not be found!', 422));
    }
};











//  * ==================== USER PROFILE
//  * POST: api/users/:id
//  * PROTECTED
const getUser = async (req, res, next) => {
    // res.json("User Profile")
    try {
        const {id} = req.params;
        const user = await User.findById(id).select('-password')
        if(!user) {
            return next(new HttpError("User not found", 404))
        } 
        res.status(200).json(user)
    } catch (error) {
        return next(new HttpError(error))
    }
}













// * ==================== CHANGE AVATAR
// * POST: api/users/change-avatar
// * PROTECTED
const changeAvatar = async (req, res, next) => {
    // res.json("Change User Avatar")
    try {
        // res.json(req.files)
        // console.log(req.files)

        if(!req.files.avatar) {
            return next(new HttpError('No Image was uploaded!', 422))
        }

        // * Find User From Database
        const user = await User.findById(req.user.id)
        // * delete old avatar is it exists 
        if(user.avatar) {
            fs.unlink(path.join(__dirname, '..', 'uploads', user.avatar), (err) => {
                if(err) {
                    return next(new HttpError(err))
                }
            })
        }

        const {avatar} = req.files;
        // * Check file size
        if(avatar.size > avatarSizeBytes) {
            // ? High file size may increase the time it takes an image to load
            return next(new HttpError(`File size exceeds ${avatarSizeMb}`, 422))
        }   
        
        let fileName
        fileName = avatar.name
        let splittedFilename = fileName.split('.') 
        let newFileName = 'avatar-' + uuid() + '.' + splittedFilename[splittedFilename.length - 1]
        avatar.mv(path.join(__dirname, '..', 'uploads', newFileName), async (err) => {
            if(err) {
                return next(new HttpError(err))
            }

            const updatedAvatar = await User.findByIdAndUpdate(req.user.id, {avatar: newFileName}, {new: true})
            if(!updatedAvatar) {
                return next(new HttpError('Avatar could not be changed', 422))
            }
            res.status(200).json(updatedAvatar)
        })

    } catch (error) {
        return next(new HttpError(error))
    }
}












// * ==================== EDIT USER DETAILS (From Profile)
// * POST: api/users/edit-user
// * PROTECTED
const editUser = async (req, res, next) => {
    try {
        const {name, email, about, currentPassword, newPassword, confirmNewPassword} = req.body;
        
        // fetch user from database
        const user = await User.findById(req.user.id)
        if(!user) return next(new HttpError('User not found', 403))

        const updatedName = name?.trim() || user.name
        const updatedEmail = email?.trim() || user.email
        const updatedAbout = about?.trim() || user.about

        // Check email uniqueness if email is being changed
        if (updatedEmail !== user.email) {
            const existingUser = await User.findOne({ email: updatedEmail, _id: { $ne: req.user.id } })
            if (existingUser) {
                return next(new HttpError('Email already in use', 422))
            }
        }

        // Only verify password if trying to change it
        let passwordWasUpdated = false;
        if (newPassword) {
            // compare current password to password stored in db
            if (!currentPassword) {
                return next(new HttpError('Current Password Required to Change Password', 422))
            }
            
            const prehashedCurrentPassword = prehashPassword(currentPassword);
            const matchedIndexForCurrent = await verifyPasswordWithPeppers(user.password, prehashedCurrentPassword, user.pepperVersion);
            if (matchedIndexForCurrent === null) {
                return next(new HttpError('Current Password is Invalid.', 422))
            }

            // If verified using an older pepper index, rehash and update to current so subsequent checks are fast
            if (matchedIndexForCurrent !== 0) {
                try {
                    const rehash = await hashWithCurrentPepper(prehashedCurrentPassword, argonOptionsStrong);
                    user.password = rehash;
                    user.pepperVersion = 0;
                    user.lastPasswordRehash = new Date();
                    await user.save();
                } catch (rehashErr) {
                    console.error('Failed to rehash on profile verify:', rehashErr);
                }
            }

            // Validate new password
            if (newPassword !== confirmNewPassword) {
                return next(new HttpError('New passwords do not match.', 422));
            }
            const prehashedNewPassword = prehashPassword(newPassword);
            if ((await verifyPasswordWithPeppers(user.password, prehashedNewPassword, user.pepperVersion)) !== null) {
                return next(new HttpError('Cannot reuse current password.', 422));
            }
            const hashedPassword = await hashWithCurrentPepper(prehashedNewPassword, argonOptions);
            user.password = hashedPassword;
            user.lastPasswordRehash = new Date();
            passwordWasUpdated = true;
        }

        // Update user fields
        user.name = updatedName;
        user.email = updatedEmail;
        user.about = updatedAbout;
        await user.save();
        
        // Get updated user without password
        const newInfo = await User.findById(req.user.id).select('-password');
        
        // Broadcast profile update via SSE
        sendSSE('profile_updated', newInfo.toObject());
        
        res.status(200).json({
            message: `User ${newInfo.id} successfully updated!`,
            ...newInfo.toObject()
        })
    } catch (error) {
       return next(new HttpError(error)) 
    }  
}










// * ==================== Get Authors
// * POST: api/users/authors
// * UNPROTECTED
const getAuthors = async (req, res, next) => {
    // res.json("Get All User/Author Profiles")
    try {
        const authors = await User.find().select('-password')
        res.json(authors)
    } catch (error) {
        return next(new HttpError(error))
    }
}












// UPDATE USER PROFILE (simple name/email/avatar update)
const updateUserProfile = async (req, res, next) => {
    try {
        const { id } = req.params
        const { name, email } = req.body
        const userId = req.user.id

        // Verify user is updating their own profile
        if (id !== userId) {
            return next(new HttpError('You can only update your own profile', 403))
        }

        // Find user
        const user = await User.findById(id)
        if (!user) {
            return next(new HttpError('User not found', 404))
        }

        // Update name if provided
        if (name && name.trim()) {
            user.name = name.trim()
        }

        // Update email if provided and not already taken
        if (email && email.trim()) {
            const existingUser = await User.findOne({ email: email.trim(), _id: { $ne: id } })
            if (existingUser) {
                return next(new HttpError('Email already in use', 422))
            }
            user.email = email.trim()
        }

        // Handle avatar upload if file provided
        if (req.files && req.files.avatar) {
            const { avatar } = req.files
            
            // Check file size (5MB limit for avatar)
            const fileSizeLimit = 5242880 // 5MB
            if (avatar.size > fileSizeLimit) {
                return next(new HttpError('Avatar too large. File should be less than 5MB', 413))
            }

            // Generate new filename
            let fileName = avatar.name
            let splittedFilename = fileName.split('.')
            let newFileName = 'avatar-' + uuid() + '.' + splittedFilename[splittedFilename.length - 1]

            // Move avatar to uploads folder
            const moveFile = (file, destination) => {
                return new Promise((resolve, reject) => {
                    file.mv(destination, (err) => {
                        if (err) reject(err)
                        else resolve()
                    })
                })
            }

            try {
                await moveFile(avatar, path.join(__dirname, '..', 'uploads', newFileName))
                user.avatar = newFileName
            } catch (err) {
                return next(new HttpError('Failed to upload avatar', 500))
            }
        }

        // Save updated user
        await user.save()

        // Return updated user (exclude password)
        const updatedUser = await User.findById(id).select('-password')
        
        // Broadcast profile update via SSE
        sendSSE('profile_updated', updatedUser.toObject())
        
        res.status(200).json({
            message: 'Profile updated successfully',
            ...updatedUser.toObject()
        })

    } catch (error) {
        return next(new HttpError(error.message || 'Failed to update profile', 500))
    }
}


export {registerUser, loginUser, getUser, changeAvatar, editUser, updateUserProfile, getAuthors}


