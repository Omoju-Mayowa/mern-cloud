import {Router} from 'express'

import { createPost, getPosts, getPost, getcategoryPosts, getUserPosts, editPost, deletePost, likePost, streamPosts } from '../controllers/postControllers.js'
import verifyToken from '../middleware/authMiddleware.js'


const router = Router()

router.post('/', verifyToken, createPost)   
router.get('/stream', streamPosts)
router.get('/', getPosts)
router.get('/categories/:category', getcategoryPosts)
router.get('/users/:id', getUserPosts)
router.get('/:id', getPost)
router.patch('/:id', verifyToken, editPost)
router.delete('/:id', verifyToken, deletePost)
router.post('/:id/like', verifyToken, likePost)

export default router
