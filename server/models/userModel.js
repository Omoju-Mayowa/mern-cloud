import { default as mongoose, Schema } from 'mongoose'

// User Scheme
const userSchema = new Schema({
        name: {type: String, required: true},
        email: {type: String, required: true, unique: true},
        password: {type: String, required: true},
        about: {type: String, default: "I am a Mern Blogger!"},
        avatar: {type: String},
        posts: {type: Number, default: 0}, 
        ipAddress: [
            {
                ip: String,
                lastSeen: { type: Date, default: Date.now() }
            }
        ],
        createdAt: { type: Date, default: Date.now() },
        failedLogins: { type: Number, default: 0 },
        updatedAt: { type: Date, default: Date.now() },
        otp: [
            {
                code: String,
                expiresAt: Date,
                verified: { type: Boolean, default: false },
                createdAt: { type: Date, default: Date.now }
            }
        ],
        pepperVersion: { type: Number, default: 0 },
        lastPasswordRehash: { type: Date, default: Date.now }
})


userSchema.pre('save', function (next) {
    this.updatedAt = Date.now()
    next()
})


const User = mongoose.model('User', userSchema)

export default User

