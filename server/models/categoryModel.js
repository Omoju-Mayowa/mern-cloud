import { default as mongoose, Schema } from 'mongoose'

const categorySchema = new Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
})

const Category = mongoose.model('Category', categorySchema)

export default Category
