#!/usr/bin/env node
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { addPeppers, migrateUserPepperVersions } from './peppers.js'
import { connectToAvailableMongoDB, disconnectMongoose } from './db.js'

// Load .env from the current working directory first, then try the server folder
// so the script works whether run from project root or the server utils dir.
dotenv.config()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const serverEnvPath = path.resolve(__dirname, '..', '.env')
if (fs.existsSync(serverEnvPath)) {
  dotenv.config({ path: serverEnvPath })
  console.log('Loaded env from', serverEnvPath)
} else {
  // helpful debug message if user expects server/.env
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

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 0) {
    console.error('Usage: node addPepper.js [--no-migrate] [--file path/to/file] "pepper1" "pepper2" ...')
    process.exit(1)
  }

  const noMigrate = args.includes('--no-migrate')
  const fileFlagIndex = args.indexOf('--file')

  let peppers = []

  if (fileFlagIndex >= 0) {
    const filePath = args[fileFlagIndex + 1]
    if (!filePath) {
      console.error('--file requires a file path')
      process.exit(1)
    }
    try {
      const fromFile = await parseFile(filePath)
      peppers.push(...fromFile)
    } catch (err) {
      console.error(err && err.message)
      process.exit(2)
    }
  }

  // collect positional peppers (exclude flags and their values)
  const filtered = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--no-migrate') continue
    if (a === '--file') { i++; continue }
    // skip file path (already consumed)
    if (fileFlagIndex >= 0 && i === fileFlagIndex + 1) continue
    filtered.push(a)
  }

  // Per convention: the first provided pepper becomes index 0 (newest-first)
  peppers = [...filtered, ...peppers]

  if (peppers.length === 0) {
    console.error('No peppers provided')
    process.exit(1)
  }

  try {
    const updated = await addPeppers(peppers)
    console.log('Added peppers to file. Current peppers length:', updated.length)

    if (noMigrate) {
      console.log('Skipping DB migration (--no-migrate specified).')
      process.exit(0)
    }

    // Attempt to connect to available MongoDB (cloud first, then local)
    try {
      const conn = await connectToAvailableMongoDB()
      console.log(`Attempting user migration by delta = ${peppers.length} on ${conn.label}`)

      const migration = await migrateUserPepperVersions(peppers.length)
      if (migration.ok) {
        console.log('User pepperVersion migration completed:', migration.result && (migration.result.modifiedCount || migration.result.nModified || migration.result.n))
        await disconnectMongoose()
        process.exit(0)
      } else {
        console.error('Migration failed:', migration.error && migration.error.message)
        await disconnectMongoose()
        process.exit(2)
      }
    } catch (err) {
      console.error('DB migration skipped: no reachable MongoDB instance or failure.', err && err.message)
      // We already wrote peppers to file — exit with non-zero code to indicate migration didn't run.
      process.exit(2)
    }

  } catch (err) {
    console.error('Failed:', err && err.message)
    process.exit(2)
  }
}

main()
