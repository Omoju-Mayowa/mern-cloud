// backend/controllers/postControllers.js

import Post from '../models/postModel.js';
import User from '../models/userModel.js';
import { v4 as uuid } from 'uuid';
import path from 'path';

import { HttpError } from '../models/errorModel.js';
import mongoose from 'mongoose';
import s3 from '../utils/r2Client.js';
import { PutObjectCommand } from "@aws-sdk/client-s3";

// Thumbnail and video max sizes
const thumbnailSizeBytes = 1073741824; // 1GB
const thumbnailSizeMb = (thumbnailSizeBytes / (1024 * 1024)).toFixed(2) + 'MB';
const videoSizeBytes = 5368709120; // 5GB
const videoSizeMb = (videoSizeBytes / (1024 * 1024)).toFixed(2) + 'MB';

// ==================== SSE Setup ====================
const sseClients = new Set();

const sendSSE = (event, payload) => {
    const data = JSON.stringify({ event, payload });
    sseClients.forEach(client => {
        try {
            client.write(`data: ${data}\n\n`);
        } catch (err) {
            console.error('Error sending SSE:', err);
            sseClients.delete(client);
        }
    });
};

// ==================== Helper: Upload file to R2 ====================
const uploadToR2 = async (fileBuffer, filename, folder = "mern") => {
    const key = `${folder}/${filename}`;
    const command = new PutObjectCommand({
        Bucket: process.env.CLOUDFLARE_R2_BUCKET,
        Key: key,
        Body: fileBuffer,
        ContentType: "video/mp4", // or "image/jpeg" dynamically
    });
    await s3.send(command);
    return `${process.env.CLOUDFLARE_R2_ENDPOINT}/${key}`;
};

// ==================== CREATE POST ====================
const createPost = async (req, res, next) => {
    try {
        const { title, category, description } = req.body;
        if (!title || !category || !description) {
            return next(new HttpError("Fill in all fields", 422));
        }

        if (!req.files || (!req.files.thumbnail && !req.files.video)) {
            return next(new HttpError("Provide either a thumbnail/image or a video", 422));
        }

        const { thumbnail, video } = req.files || {};
        let thumbnailUrl = null;
        let videoUrl = null;

        if (thumbnail) {
            if (thumbnail.size > thumbnailSizeBytes) {
                return next(new HttpError(`Thumbnail too big. Max ${thumbnailSizeMb}`, 413));
            }
            const ext = path
