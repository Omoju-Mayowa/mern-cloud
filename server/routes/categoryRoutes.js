import { Router } from 'express'
import { getCategories, createCategory } from '../controllers/categoryController.js'
import verifyToken from '../middleware/authMiddleware.js'

const router = Router()

router.get('/', getCategories)
router.post('/', verifyToken, createCategory)

export default router
