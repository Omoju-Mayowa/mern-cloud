import jwt from 'jsonwebtoken'
import { HttpError } from '../models/errorModel.js'

 

const verifyToken = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization
        if(!authHeader || !authHeader.startsWith('Bearer ')) {
            return next(new HttpError('No token provided!', 401))
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        req.user = decoded
        next()
    } catch (error) {
        if(error.name === 'TokenExpiredError') {
            return next(new HttpError('Session Expired. Please log in again', 401))
        }   else if(error.name === 'JsonWebTokenError') {
            return next(new HttpError('Invalid Token. Please log in again', 403))
        }

        return next(new HttpError('Authentication Failed.', 401))
    }
}

export default verifyToken;