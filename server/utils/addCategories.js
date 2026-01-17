#!/usr/bin/env node
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { connectToAvailableMongoDB, disconnectMongoose } from './db.js'
import Category from '../models/categoryModel.js'

// Load .env from the current working directory first, then try the server folder
dotenv.config()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const serverEnvPath = path.resolve(__dirname, '..', '.env')
if (fs.existsSync(serverEnvPath)) {
  dotenv.config({ path: serverEnvPath })
  console.log('Loaded env from', serverEnvPath)
} else {
  console.log('No env file at', serverEnvPath, ' — using process.env or cwd .env if present')
}

async function parseFile(filePath) {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath)
  try {
    const raw = fs.readFileSync(abs, 'utf8')
    return raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  } catch (err) {
    throw new Error('Failed to read file: ' + (err && err.message))
  }
}

async function insertCategories(categoryList) {
  try {
    const conn = await connectToAvailableMongoDB()
    console.log(`Connected to MongoDB on ${conn.label}`)

    const created = []
    const skipped = []

    for (const categoryName of categoryList) {
      const exists = await Category.findOne({ name: categoryName })
      if (exists) {
        skipped.push(categoryName)
        continue
      }
      const cat = await Category.create({ name: categoryName, description: '' })
      created.push(categoryName)
    }

    console.log(`\nCategory insertion complete:`)
    console.log(`✓ Created: ${created.length} - [${created.join(', ')}]`)
    if (skipped.length > 0) {
      console.log(`⊘ Skipped (already exist): ${skipped.length} - [${skipped.join(', ')}]`)
    }

    await disconnectMongoose()
    process.exit(0)
  } catch (err) {
    console.error('Failed to insert categories:', err && err.message)
    await disconnectMongoose()
    process.exit(1)
  }
}

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.error('Usage: node addCategories.js [--file path/to/file] "Category1" "Category2" ...')
    console.error('\nExamples:')
    console.error('  node addCategories.js "Agriculture" "Business" "Education"')
    console.error('  node addCategories.js --file categories.txt')
    process.exit(1)
  }

  const fileFlagIndex = args.indexOf('--file')
  let categories = []

  // If --file flag is present, read from file
  if (fileFlagIndex >= 0) {
    const filePath = args[fileFlagIndex + 1]
    if (!filePath) {
      console.error('--file requires a file path')
      process.exit(1)
    }
    try {
      const fromFile = await parseFile(filePath)
      categories.push(...fromFile)
    } catch (err) {
      console.error(err && err.message)
      process.exit(2)
    }
  }

  // Collect positional arguments (category names)
  const filtered = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--file') { i++; continue } // skip --file and its path
    if (a.startsWith('--')) continue // skip other flags
    filtered.push(a)
  }

  categories = [...categories, ...filtered]

  if (categories.length === 0) {
    console.error('No categories provided')
    process.exit(1)
  }

  console.log(`Inserting ${categories.length} categories:`)
  categories.forEach((cat, i) => console.log(`  ${i + 1}. ${cat}`))
  console.log()

  await insertCategories(categories)
}

main()
