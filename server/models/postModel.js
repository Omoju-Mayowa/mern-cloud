import { default as mongoose, Schema } from 'mongoose'

// POST Schema
const postSchema = new Schema ({
    title: { type: String, required: true },
    description: { type: String, required: true },
    thumbnail: { type: String, default: null }, // Optional - can be null if only video provided
    videoUrl: { type: String, default: null },
    creator: { type: Schema.Types.ObjectId, ref: "User" },

    // category 
    category: {type: String, required: true},
    // Likes: count and list of users who liked the post
    likesCount: { type: Number, default: 0 },
    likedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
}, {timestamps: true})


const Post = mongoose.model('Post', postSchema)

export default Post


