import Post from '../models/postModel.js'
import User from '../models/userModel.js'

import fs from 'fs'
import path from 'path'
import { v4 as uuid } from 'uuid'

import { HttpError } from '../models/errorModel.js'
import __dirname from '../utils/directory.js'
import mongoose from 'mongoose'

// Thumbnail Size Variables
const thumbnailSizeBytes = 1073741824; // Currently 1GB
const thumbnailSizeMb = (thumbnailSizeBytes / ( 1024 * 1024 )).toFixed(2) + 'MB'
const videoSizeBytes = 5368709120; // 5GB for videos
const videoSizeMb = (videoSizeBytes / ( 1024 * 1024 )).toFixed(2) + 'MB'

// * ==================== SSE (Server-Sent Events) Setup
// SSE clients storage
const sseClients = new Set()

// Helper function to send SSE to all clients
const sendSSE = (event, payload) => {
    const data = JSON.stringify({ event, payload })
    sseClients.forEach(client => {
        try {
            client.write(`data: ${data}\n\n`)
        } catch (err) {
            console.error('Error sending SSE:', err)
            sseClients.delete(client)
        }
    })
}

// * ==================== CREATE POST
// * POST: api/posts
// * PROTECTED
const createPost = async (req, res, next) => {
    try {
        // To Prevent Empty inputs
        const {title, category, description} = req.body
        if(!title || !category || !description) {
            return next(new HttpError("Fill in all Fields (title, category, description)", 422))
        }

        // At least one of thumbnail or video must be provided
        if(!req.files || (!req.files.thumbnail && !req.files.video)) {
            return next(new HttpError("Please provide either a thumbnail/image or a video", 422))
        }

        const {thumbnail, video} = req.files || {}
        
        const moveFile = (file, destination) => {
            return new Promise((resolve, reject) => {
                file.mv(destination, (err) => {
                    if (err) reject(err)
                    else resolve()
                })
            })
        }

        // Handle thumbnail if provided
        let newFileName = null
        if (thumbnail) {
            // check thumbnail size
            if (thumbnail.size > thumbnailSizeBytes) {
                return next(new HttpError(`Thumbnail too big. File should be less than ${thumbnailSizeMb}`), 413)
            }
            let fileName = thumbnail.name
            let splittedFilename = fileName.split('.')
            newFileName = 'thumbnail-' + uuid() + '.' + splittedFilename[splittedFilename.length - 1]
            await moveFile(thumbnail, path.join(__dirname, '..', 'uploads', newFileName))
        }

        // Handle video file if provided
        let videoFileName = null
        if (video) {
            // check video size if provided
            if (video.size > videoSizeBytes) {
                return next(new HttpError(`Video too big. File should be less than ${videoSizeMb}`), 413)
            }
            let videoName = video.name
            let videoSplitted = videoName.split('.')
            videoFileName = 'video-' + uuid() + '.' + videoSplitted[videoSplitted.length - 1]
            await moveFile(video, path.join(__dirname, '..', 'uploads', videoFileName))
        }

        // Create post - thumbnail can be null if only video is provided
        const postData = {
            title, 
            category, 
            description, 
            videoUrl: videoFileName, 
            creator: req.user.id
        }
        // Only add thumbnail if we have one (don't use default-avatar.png for posts)
        if (newFileName) {
            postData.thumbnail = newFileName
        } else {
            // For video-only posts, thumbnail is null - frontend will display video directly
            postData.thumbnail = null
        }
        
        const newPost = await Post.create(postData)

        if(!newPost) {
            return next(new HttpError("Post couldn't be created"), 422)
        }

        const currentUser = await User.findById(req.user.id)

        const userPostCount = currentUser.posts + 1

        await User.findByIdAndUpdate(req.user.id, {posts: userPostCount})

        // Get updated user for broadcast
        const updatedUser = await User.findById(req.user.id).select('-password')

        // Broadcast new post and user update via SSE
        sendSSE('post_created', newPost)
        sendSSE('profile_updated', updatedUser.toObject())

        res.status(200).json(newPost)        

    } catch (error) {
        return next(new HttpError(error))
    }
}

// * ==================== GET ALL POSTS
// * GET: api/posts
// * UNPROTECTED
const getPosts = async (req, res, next) => {
    try {
        const posts = await Post.find().sort({updatedAt: -1})
        res.status(200).json(posts)
    } catch (error) {
        console.error(error)  // log real backend error
        return next(new HttpError(error.message || 'Server error', 500))
    }
}

// * ==================== GET SINGLE POST
// * GET: api/posts/:id
// * UNPROTECTED
const getPost = async (req, res, next) => {
    try {
        const postId = req.params.id
        const post = await Post.findById(postId)

        if(!mongoose.Types.ObjectId.isValid(postId)) {
            return next(new HttpError('Invalid Post ID.', 404))
        }

        if(!post) {
            return next(new HttpError('Post not found'), 404)
        }
        res.status(200).json(post)
    } catch (err) {
        return next(new HttpError(err))
    }
}

// * ==================== GET POSTS BY category
// * GET: api/posts
// * UNPROTECTED
const getcategoryPosts = async (req, res, next) => {
    try {
        const {category} = req.params
        const catPosts = await Post.find( {category} ).sort( {createdAt: -1} )
        res.status(200).json(catPosts)
    } catch (error) {
        return next(new HttpError(error))
    }
}

// * ==================== GET AUTHOR POSTS
// * GET: api/posts/users/:id
// * UNPROTECTED
const getUserPosts = async (req, res, next) => {
    try {
        const {id} = req.params
        const posts = await Post.find( {creator: id} ).sort( {createdAt: -1} )
        res.status(200).json(posts)
    } catch (error) {
        return next(new HttpError(error))
    }
}

// * ==================== EDIT POST
// * PATCH: api/posts/:id
// * PROTECTED
const editPost = async (req, res, next) => {
    try {
        const postId = req.params.id
        let {title, category, description} = req.body
        
        // by default react quill has paragraph openong and closing tag with a break tag in between, so it has 11 characters by default
        if(!title || !category || !description || description.length < 11) {
            return next(new HttpError("Fill in all Fields", 422))
        }

        // grab old post from db
        const oldPost = await Post.findById(postId)
        if(!oldPost) {
            return next(new HttpError('Post not found', 404))
        }

        // Check authorization
        if(req.user.id.toString() !== oldPost.creator.toString()) {
            return next(new HttpError('You are not authorized to update this post', 403))
        }

        const moveFile = (file, destination) => {
            return new Promise((resolve, reject) => {
                file.mv(destination, (err) => {
                    if (err) reject(err)
                    else resolve()
                })
            })
        }

        const updateData = {title, category, description}

        // Handle thumbnail if provided
        if(req.files && req.files.thumbnail) {
            const {thumbnail} = req.files
            if(thumbnail.size > thumbnailSizeBytes) {
                return next(new HttpError(`Thumbnail too big. File should be less than ${thumbnailSizeMb}`), 413)
            }

            // Delete old thumbnail if it exists and is not default
            if(oldPost.thumbnail && oldPost.thumbnail !== 'default-avatar.png') {
                fs.unlink(path.join(__dirname, '..', 'uploads', oldPost.thumbnail), (err) => {
                    // Ignore errors if file doesn't exist
                })
            }

            // Upload new thumbnail
            let fileName = thumbnail.name
            let splittedFilename = fileName.split('.')
            let newFileName = 'thumbnail-' + uuid() + '.' + splittedFilename[splittedFilename.length - 1]
            await moveFile(thumbnail, path.join(__dirname, '..', 'uploads', newFileName))
            updateData.thumbnail = newFileName
        }

        // Handle video if provided
        if(req.files && req.files.video) {
            const {video} = req.files
            if(video.size > videoSizeBytes) {
                return next(new HttpError(`Video too big. File should be less than ${videoSizeMb}`), 413)
            }

            // Delete old video if it exists
            if(oldPost.videoUrl) {
                fs.unlink(path.join(__dirname, '..', 'uploads', oldPost.videoUrl), (err) => {
                    // Ignore errors if file doesn't exist
                })
            }

            // Upload new video
            let videoName = video.name
            let videoSplitted = videoName.split('.')
            let videoFileName = 'video-' + uuid() + '.' + videoSplitted[videoSplitted.length - 1]
            await moveFile(video, path.join(__dirname, '..', 'uploads', videoFileName))
            updateData.videoUrl = videoFileName
        }

        const updatedPost = await Post.findByIdAndUpdate(postId, updateData, {new: true})
        
        if(!updatedPost) {
            return next(new HttpError("Post couldn't be updated"), 422)
        }

        // Broadcast post update via SSE
        sendSSE('post_updated', updatedPost)

        res.status(200).json(updatedPost)
    } catch (error) {
        return next(new HttpError(error))
    }
}

// * ==================== DELETE POST
// * DELETE: api/posts/:id
// * PROTECTED
const deletePost = async (req, res, next) => {
    try {
        const postId = req.params.id
        if(!postId) {
            return next(new HttpError('Post Unavailable.', 400))
        }
        const post = await Post.findById(postId)
        
        // Add this check
        if(!post) {
            return next(new HttpError('Post not found.', 404))
        }
        
        if(req.user.id.toString() === post.creator.toString()) {
            // Delete files first
            const deletePromises = []
            
            // Delete thumbnail if it exists and is not a placeholder
            if (post.thumbnail && post.thumbnail !== 'video-placeholder.png' && post.thumbnail !== 'default-avatar.png') {
                deletePromises.push(
                    new Promise((resolve) => {
                        fs.unlink(path.join(__dirname, '..', 'uploads', post.thumbnail), (err) => {
                            // Ignore errors if file doesn't exist
                            resolve()
                        })
                    })
                )
            }
            
            // Delete video if it exists
            if (post.videoUrl) {
                deletePromises.push(
                    new Promise((resolve) => {
                        fs.unlink(path.join(__dirname, '..', 'uploads', post.videoUrl), (err) => {
                            // Ignore errors if file doesn't exist
                            resolve()
                        })
                    })
                )
            }
            
            // Wait for all file deletions, then delete post
            await Promise.all(deletePromises)
            
            // Delete post from database
            await Post.findByIdAndDelete(postId)
            
            // Reduce User Post Count by 1
            const currentUser = await User.findById(req.user.id)
            const userPostCount = Math.max(0, (currentUser?.posts || 0) - 1)
            await User.findByIdAndUpdate(req.user.id, {posts: userPostCount})
            
            // Get updated user for broadcast
            const updatedUser = await User.findById(req.user.id).select('-password')
            
            // Broadcast post deletion and user update via SSE
            sendSSE('post_deleted', { postId, userId: req.user.id })
            sendSSE('profile_updated', updatedUser.toObject())

            res.status(200).json(`Post ${postId} deleted successfully`)
        }   else {
            return next(new HttpError("You are not authorized to delete this post", 403))
        }
    } catch (error) {
        return next(new HttpError(error))
    }
}

// * ==================== LIKE POST
// * POST: api/posts/:id/like
// * PROTECTED
const likePost = async (req, res, next) => {
    try {
        const postId = req.params.id
        const userId = req.user.id

        const post = await Post.findById(postId)
        if (!post) {
            return next(new HttpError('Post not found', 404))
        }

        // Ensure likedBy is an array
        if (!Array.isArray(post.likedBy)) {
            post.likedBy = []
        }

        const isLiked = post.likedBy.some(id => id.toString() === userId.toString())

        if (isLiked) {
            // Unlike: remove user from likedBy and decrement count
            post.likedBy = post.likedBy.filter(id => id.toString() !== userId.toString())
            post.likesCount = Math.max(0, post.likesCount - 1)
        } else {
            // Like: add user to likedBy and increment count
            post.likedBy.push(userId)
            post.likesCount = (post.likesCount || 0) + 1
        }

        await post.save()

        // Broadcast like event via SSE
        sendSSE('post_liked', { postId, likesCount: post.likesCount })

        res.status(200).json({
            liked: !isLiked,
            likesCount: post.likesCount
        })
    } catch (error) {
        return next(new HttpError(error.message || 'Failed to like post', 500))
    }
}

// * ==================== STREAM POSTS (SSE)
// * GET: api/posts/stream
// * UNPROTECTED
const streamPosts = (req, res) => {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no') // Disable buffering for nginx
    
    // CORS headers
    const origin = req.headers.origin
    if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin)
        res.setHeader('Access-Control-Allow-Credentials', 'true')
    }

    // Add client to set
    sseClients.add(res)

    // Send initial connection message
    try {
        res.write(`data: ${JSON.stringify({ event: 'connected', payload: {} })}\n\n`)
    } catch (err) {
        console.error('Error writing initial SSE message:', err)
        sseClients.delete(res)
        return
    }

    // Keep connection alive with periodic heartbeat
    const heartbeat = setInterval(() => {
        try {
            if (sseClients.has(res)) {
                res.write(`: heartbeat\n\n`)
            } else {
                clearInterval(heartbeat)
            }
        } catch (err) {
            clearInterval(heartbeat)
            sseClients.delete(res)
        }
    }, 30000) // Every 30 seconds

    // Remove client on disconnect
    req.on('close', () => {
        clearInterval(heartbeat)
        sseClients.delete(res)
    })

    // Handle errors
    res.on('error', (err) => {
        console.error('SSE connection error:', err)
        clearInterval(heartbeat)
        sseClients.delete(res)
    })
}

export { createPost, getPosts, getPost, getcategoryPosts, getUserPosts, editPost, deletePost, likePost, streamPosts, sendSSE }
