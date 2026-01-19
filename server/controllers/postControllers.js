// backend/controllers/postControllers.js
import Post from '../models/postModel.js';
import User from '../models/userModel.js';
import { v4 as uuid } from 'uuid';
import path from 'path';
import mongoose from 'mongoose';
import s3 from '../utils/r2Client.js';
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { HttpError } from '../models/errorModel.js';

const thumbnailSizeBytes = 1073741824; 
const videoSizeBytes = 5368709120; 

const sseClients = new Set();
const sendSSE = (event, payload) => {
    const data = JSON.stringify({ event, payload });
    sseClients.forEach(client => {
        try { client.write(`data: ${data}\n\n`); } catch (err) { sseClients.delete(client); }
    });
};

// ==================== FIXED UPLOAD LOGIC ====================
// backend/controllers/postControllers.js

const uploadToR2 = async (fileBuffer, filename, folder = "mern") => {
    const key = `${folder}/${filename}`; // Result: "mern/filename.jpg"
    const command = new PutObjectCommand({
        Bucket: process.env.CLOUDFLARE_R2_BUCKET,
        Key: key,
        Body: fileBuffer,
        ContentType: "image/jpeg", // Change based on file type if possible
    });
    await s3.send(command);

    // Return the FULL URL
    // Result: https://pub-xxx.r2.dev/mern/filename.jpg
    return `${process.env.CLOUDFLARE_R2_ASSETS_URL}/${key}`;
};

const createPost = async (req, res, next) => {
    try {
        const { title, category, description } = req.body;
        if (!title || !category || !description) return next(new HttpError("Fill in all fields", 422));
        if (!req.files || (!req.files.thumbnail && !req.files.video)) return next(new HttpError("Provide media", 422));

        const { thumbnail, video } = req.files;
        let thumbnailPath = null;
        let videoPath = null;

        if (thumbnail) {
            if (thumbnail.size > thumbnailSizeBytes) return next(new HttpError("Thumbnail too big", 413));
            thumbnailPath = await uploadToR2(thumbnail, "mern");
        }

        if (video) {
            if (video.size > videoSizeBytes) return next(new HttpError("Video too big", 413));
            videoPath = await uploadToR2(video, "mern");
        }

        const newPost = await Post.create({
            title, category, description,
            thumbnail: thumbnailPath,
            videoUrl: videoPath,
            creator: req.user.id
        });

        const currentUser = await User.findById(req.user.id);
        await User.findByIdAndUpdate(req.user.id, { posts: (currentUser.posts || 0) + 1 });
        
        sendSSE('post_created', newPost);
        res.status(200).json(newPost);
    } catch (error) {
        return next(new HttpError(error.message, 500));
    }
};

// ==================== GET POSTS ====================
const getPosts = async (req, res, next) => {
    try {
        const posts = await Post.find().sort({ updatedAt: -1 });
        res.status(200).json(posts);
    } catch (error) {
        return next(new HttpError(error.message || 'Server error', 500));
    }
};

// ==================== GET SINGLE POST ====================
const getPost = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return next(new HttpError('Invalid Post ID', 404));

        const post = await Post.findById(id);
        if (!post) return next(new HttpError('Post not found', 404));

        res.status(200).json(post);
    } catch (error) {
        return next(new HttpError(error.message || 'Server error', 500));
    }
};

// ==================== GET POSTS BY CATEGORY ====================
const getcategoryPosts = async (req, res, next) => {
    try {
        const { category } = req.params;
        const posts = await Post.find({ category }).sort({ createdAt: -1 });
        res.status(200).json(posts);
    } catch (error) {
        return next(new HttpError(error.message || 'Server error', 500));
    }
};

// ==================== GET USER POSTS ====================
const getUserPosts = async (req, res, next) => {
    try {
        const { id } = req.params;
        const posts = await Post.find({ creator: id }).sort({ createdAt: -1 });
        res.status(200).json(posts);
    } catch (error) {
        return next(new HttpError(error.message || 'Server error', 500));
    }
};

// ==================== EDIT POST ====================
const editPost = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { title, category, description } = req.body;

        if (!title || !category || !description || description.length < 11) {
            return next(new HttpError("Fill in all fields", 422));
        }

        if (!mongoose.Types.ObjectId.isValid(id)) return next(new HttpError('Invalid Post ID', 404));

        const oldPost = await Post.findById(id);
        if (!oldPost) return next(new HttpError('Post not found', 404));
        if (req.user.id.toString() !== oldPost.creator.toString()) return next(new HttpError('Unauthorized', 403));

        const updateData = { title, category, description };

        if (req.files?.thumbnail) {
            const { thumbnail } = req.files;
            if (thumbnail.size > thumbnailSizeBytes) return next(new HttpError(`Thumbnail too big. Max ${thumbnailSizeMb}`, 413));
            const ext = path.extname(thumbnail.name);
            const newFileName = `thumbnail-${uuid()}${ext}`;
            updateData.thumbnail = await uploadToR2(thumbnail.data, newFileName);
        }

        if (req.files?.video) {
            const { video } = req.files;
            if (video.size > videoSizeBytes) return next(new HttpError(`Video too big. Max ${videoSizeMb}`, 413));
            const ext = path.extname(video.name);
            const newVideoName = `video-${uuid()}${ext}`;
            updateData.videoUrl = await uploadToR2(video.data, newVideoName);
        }

        const updatedPost = await Post.findByIdAndUpdate(id, updateData, { new: true });
        sendSSE('post_updated', updatedPost);

        res.status(200).json(updatedPost);
    } catch (error) {
        return next(new HttpError(error.message || 'Failed to edit post', 500));
    }
};

// ==================== DELETE POST ====================
const deletePost = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return next(new HttpError('Invalid Post ID', 404));

        const post = await Post.findById(id);
        if (!post) return next(new HttpError('Post not found', 404));
        if (req.user.id.toString() !== post.creator.toString()) return next(new HttpError('Unauthorized', 403));

        await Post.findByIdAndDelete(id);

        const currentUser = await User.findById(req.user.id);
        await User.findByIdAndUpdate(req.user.id, { posts: Math.max(0, (currentUser.posts || 0) - 1) });

        sendSSE('post_deleted', { postId: id, userId: req.user.id });

        res.status(200).json({ message: `Post ${id} deleted successfully` });
    } catch (error) {
        return next(new HttpError(error.message || 'Failed to delete post', 500));
    }
};

// ==================== LIKE POST ====================
const likePost = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        if (!mongoose.Types.ObjectId.isValid(id)) return next(new HttpError('Invalid Post ID', 404));

        const post = await Post.findById(id);
        if (!post) return next(new HttpError('Post not found', 404));

        if (!Array.isArray(post.likedBy)) post.likedBy = [];

        const liked = post.likedBy.some(uid => uid.toString() === userId.toString());

        if (liked) {
            post.likedBy = post.likedBy.filter(uid => uid.toString() !== userId.toString());
            post.likesCount = Math.max(0, (post.likesCount || 1) - 1);
        } else {
            post.likedBy.push(userId);
            post.likesCount = (post.likesCount || 0) + 1;
        }

        await post.save();
        sendSSE('post_liked', { postId: id, likesCount: post.likesCount });

        res.status(200).json({ liked: !liked, likesCount: post.likesCount });
    } catch (error) {
        return next(new HttpError(error.message || 'Failed to like post', 500));
    }
};

// ==================== STREAM POSTS (SSE) ====================
const streamPosts = (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const origin = req.headers.origin;
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    sseClients.add(res);
    res.write(`data: ${JSON.stringify({ event: 'connected', payload: {} })}\n\n`);

    const heartbeat = setInterval(() => {
        if (sseClients.has(res)) res.write(`: heartbeat\n\n`);
        else clearInterval(heartbeat);
    }, 30000);

    req.on('close', () => { clearInterval(heartbeat); sseClients.delete(res); });
    res.on('error', () => { clearInterval(heartbeat); sseClients.delete(res); });
};

export {
    createPost,
    getPosts,
    getPost,
    getcategoryPosts,
    getUserPosts,
    editPost,
    deletePost,
    likePost,
    streamPosts,
    sendSSE
};
