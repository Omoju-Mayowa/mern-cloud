import {Router} from 'express'
import { sendResetOTP, resetPassword } from '../controllers/passwordResetController.js'
import {registerUser, loginUser, getUser, changeAvatar, editUser, getAuthors, updateUserProfile} from '../controllers/userControllers.js'
import verifyToken from '../middleware/authMiddleware.js'

const router = Router()
//Unprotected Routes

router.post('/register', registerUser)
router.post('/login', loginUser)
router.get('/:id', getUser)
router.get('/',  getAuthors)

router.post('/forgot-password', sendResetOTP);
router.post('/reset-password', resetPassword);

//Protected routes
router.post('/change-avatar', verifyToken, changeAvatar)
router.patch('/edit-user', verifyToken, editUser)
router.patch('/:id', verifyToken, updateUserProfile)

export default router