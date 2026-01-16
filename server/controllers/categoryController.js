import Category from '../models/categoryModel.js'
import { HttpError } from '../models/errorModel.js'

// Get all categories
const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find().sort({ createdAt: 1 })
    res.status(200).json(categories)
  } catch (error) {
    return next(new HttpError(error.message || 'Failed to fetch categories', 500))
  }
}

// Create a new category (admin only)
const createCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body
    if (!name) {
      return next(new HttpError('Category name is required', 422))
    }

    const exists = await Category.findOne({ name })
    if (exists) {
      return next(new HttpError('Category already exists', 409))
    }

    const category = await Category.create({ name, description: description || '' })
    res.status(201).json(category)
  } catch (error) {
    return next(new HttpError(error.message || 'Failed to create category', 500))
  }
}

export { getCategories, createCategory }
