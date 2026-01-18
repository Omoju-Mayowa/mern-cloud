// ================= POST CONTROLLER =================
import Post from '../models/postModel.js';
import User from '../models/userModel.js';
import { v4 as uuid } from 'uuid';
import { HttpError } from '../models/errorModel.js';
import mongoose from 'mongoose';
import { sendSSE } from './userController.js';
import { s3Client, R2_BUCKET, getR2PublicUrl } from '../utils/r2Client.js'; // R2 utility functions
import fs from 'fs';

// File size limits
const thumbnailSizeBytes = 1073741824; // 1GB
const videoSizeBytes = 5368709120; // 5GB

// SSE clients
const sseClients = new Set();
const sendSSEAll = (event, payload) => {
    sseClients.forEach(c => {
        try { c.write(`data: ${JSON.stringify({ event, payload })}\n\n`) }
        catch { sseClients.delete(c) }
    });
};

// Helper: upload file to R2
async function uploadToR2(file, prefix = 'posts') {
    const ext = file.name.split('.').pop();
    const key = `${prefix}-${uuid()}.${ext}`;
    await s3Client.putObject({
        Bucket: R2_BUCKET,
        Key: key,
        Body: file.data,
        ContentType: file.mimetype,
    });
    return getR2PublicUrl(key);
}

// Helper: delete file from R2
async function deleteFromR2(fileUrl) {
    if (!fileUrl) return;
    try {
        const key = fileUrl.split('/').pop();
        await s3Client.deleteObject({ Bucket: R2_BUCKET, Key: key });
    } catch {}
}

// CREATE POST
const createPost = async (req, res, next) => {
    try {
        const { title, category, description } = req.body;
        if (!title || !category || !description) return next(new HttpError('Fill in all fields', 422));

        if (!req.files || (!req.files.thumbnail && !req.files.video))
            return next(new HttpError('Provide a thumbnail or video', 422));

        let thumbnailUrl = null;
        let videoUrl = null;

        if (req.files.thumbnail) {
            if (req.files.thumbnail.size > thumbnailSizeBytes)
                return next(new HttpError('Thumbnail too large', 413));
            thumbnailUrl = await uploadToR2(req.files.thumbnail, 'thumbnail');
        }

        if (req.files.video) {
            if (req.files.video.size > videoSizeBytes)
                return next(new HttpError('Video too large', 413));
            videoUrl = await uploadToR2(req.files.video, 'video');
        }

        const postData = {
            title, category, description, creator: req.user.id,
            thumbnail: thumbnailUrl, videoUrl
        };

        const newPost = await Post.create(postData);
        const user = await User.findById(req.user.id);
        await User.findByIdAndUpdate(req.user.id, { posts: (user.posts || 0) + 1 });

        sendSSEAll('post_created', newPost);
        sendSSEAll('profile_updated', await User.findById(req.user.id).select('-password'));

        res.status(200).json(newPost);
    } catch (err) {
        next(new HttpError(err.message || 'Failed to create post', 500));
    }
};

// EDIT POST
const editPost = async (req, res, next) => {
    try {
        const postId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(postId)) return next(new HttpError('Invalid Post ID', 404));

        const post = await Post.findById(postId);
        if (!post) return next(new HttpError('Post not found', 404));
        if (req.user.id.toString() !== post.creator.toString())
            return next(new HttpError('Not authorized', 403));

        const { title, category, description } = req.body;
        const updateData = { title, category, description };

        if (req.files?.thumbnail) {
            if (req.files.thumbnail.size > thumbnailSizeBytes)
                return next(new HttpError('Thumbnail too large', 413));
            await deleteFromR2(post.thumbnail);
            updateData.thumbnail = await uploadToR2(req.files.thumbnail, 'thumbnail');
        }

        if (req.files?.video) {
            if (req.files.video.size > videoSizeBytes)
                return next(new HttpError('Video too large', 413));
            await deleteFromR2(post.videoUrl);
            updateData.videoUrl = await uploadToR2(req.files.video, 'video');
        }

        const updatedPost = await Post.findByIdAndUpdate(postId, updateData, { new: true });
        sendSSEAll('post_updated', updatedPost);
        res.status(200).json(updatedPost);
    } catch (err) {
        next(new HttpError(err.message || 'Failed to edit post', 500));
    }
};

// DELETE POST
const deletePost = async (req, res, next) => {
    try {
        const postId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(postId)) return next(new HttpError('Invalid Post ID', 404));

        const post = await Post.findById(postId);
        if (!post) return next(new HttpError('Post not found', 404));
        if (req.user.id.toString() !== post.creator.toString())
            return next(new HttpError('Not authorized', 403));

        await deleteFromR2(post.thumbnail);
        await deleteFromR2(post.videoUrl);
        await Post.findByIdAndDelete(postId);

        const user = await User.findById(req.user.id);
        await User.findByIdAndUpdate(req.user.id, { posts: Math.max(0, (user.posts || 1) - 1) });

        sendSSEAll('post_deleted', { postId, userId: req.user.id });
        sendSSEAll('profile_updated', await User.findById(req.user.id).select('-password'));

        res.status(200).json({ message: `Post ${postId} deleted` });
    } catch (err) {
        next(new HttpError(err.message || 'Failed to delete post', 500));
    }
};

// LIKE POST (unchanged logic)
const likePost = async (req, res, next) => {
    try {
        const postId = req.params.id;
        const userId = req.user.id;
        const post = await Post.findById(postId);
        if (!post) return next(new HttpError('Post not found', 404));

        if (!Array.isArray(post.likedBy)) post.likedBy = [];
        const liked = post.likedBy.includes(userId);
        liked ? post.likedBy.pull(userId) : post.likedBy.push(userId);
        post.likesCount = post.likedBy.length;

        await post.save();
        sendSSEAll('post_liked', { postId, likesCount: post.likesCount });
        res.status(200).json({ liked: !liked, likesCount: post.likesCount });
    } catch (err) {
        next(new HttpError(err.message || 'Failed to like post', 500));
    }
};

// GET POSTS
const getPosts = async (req, res, next) => {
    try {
        const posts = await Post.find().sort({ updatedAt: -1 });
        res.status(200).json(posts);
    } catch (err) { next(new HttpError(err.message || 'Failed to fetch posts', 500)) }
};

// GET SINGLE POST
const getPost = async (req, res, next) => {
    try {
        const postId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(postId)) return next(new HttpError('Invalid Post ID', 404));

        const post = await Post.findById(postId);
        if (!post) return next(new HttpError('Post not found', 404));

        res.status(200).json(post);
    } catch (err) { next(new HttpError(err.message || 'Failed to fetch post', 500)) }
};

// STREAM POSTS (SSE)
const streamPosts = (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    sseClients.add(res);
    res.write(`data: ${JSON.stringify({ event: 'connected', payload: {} })}\n\n`);

    const interval = setInterval(() => { res.write(': heartbeat\n\n') }, 30000);
    req.on('close', () => { clearInterval(interval); sseClients.delete(res) });
    res.on('error', () => { clearInterval(interval); sseClients.delete(res) });
};

export { createPost, editPost, deletePost, getPosts, getPost, likePost, streamPosts };
