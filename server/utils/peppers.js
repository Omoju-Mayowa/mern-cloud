import fs from 'fs'
import path from 'path'
import __dirname from './directory.js'
import User from '../models/userModel.js'

const PEPPERS_FILE = path.join(__dirname, '..', 'config', 'peppers.json')

let _cache = null

function _buildFromEnv() {
  const envCurrent = (process.env.PEPPER || '').trim()
  const envOld = (process.env.PEPPER_OLD || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  if (envCurrent) return [envCurrent, ...envOld]
  // fallback: check for PEPPERS var (comma-separated, newest-first)
  if (process.env.PEPPERS) {
    return process.env.PEPPERS.split(',').map(s => s.trim()).filter(Boolean)
  }
  return []
}

function _load() {
  if (_cache) return _cache
  try {
    if (fs.existsSync(PEPPERS_FILE)) {
      const raw = fs.readFileSync(PEPPERS_FILE, 'utf8')
      _cache = JSON.parse(raw)
      if (!Array.isArray(_cache)) _cache = []
      return _cache
    }
  } catch (err) {
    // if reading fails, fallback to env
    console.error('Failed to read peppers file, falling back to env (no pepper values logged)')
  }

  // initialize from env and write file
  const fromEnv = _buildFromEnv()
  try {
    fs.mkdirSync(path.dirname(PEPPERS_FILE), { recursive: true })
    fs.writeFileSync(PEPPERS_FILE, JSON.stringify(fromEnv, null, 2), { mode: 0o600 })
  } catch (err) {
    console.error('Failed to initialize peppers file', err && err.message)
  }
  _cache = fromEnv
  return _cache
}

function getPeppers() {
  // return a fresh copy to avoid accidental external mutation
  return [..._load()]
}

function getCurrentPepper() {
  const p = getPeppers()
  return p[0] || ''
}

function getPepperByIndex(i) {
  const p = getPeppers()
  return p[i]
}

function getLength() {
  return getPeppers().length
}

/**
 * Add multiple peppers at once. `newPeppers` should be an array of strings.
 * The first element of the array becomes index 0 (newest-first).
 */
async function addPeppers(newPeppers) {
  if (!Array.isArray(newPeppers) || newPeppers.length === 0) throw new Error('Invalid peppers')
  const toAdd = newPeppers.map(p => (p || '').toString()).filter(Boolean)
  if (toAdd.length === 0) throw new Error('No valid peppers provided')

  const peppers = getPeppers()
  // insert at front preserving provided order (first becomes index 0)
  peppers.unshift(...toAdd)

  try {
    fs.writeFileSync(PEPPERS_FILE, JSON.stringify(peppers, null, 2), { mode: 0o600 })
  } catch (err) {
    console.error('Failed to write peppers file', err && err.message)
    throw err
  }

  // refresh cache
  _cache = peppers
  return peppers
}

/**
 * Backwards-compatible single-pepper helper
 */
async function addPepper(newPepper) {
  return await addPeppers([newPepper])
}

/**
 * Attempt to increment pepperVersion for all users by the given delta.
 * Returns { ok: true } on success or { ok: false, error }
 */
async function migrateUserPepperVersions(delta = 1) {
  if (!Number.isInteger(delta) || delta <= 0) {
    return { ok: false, error: new Error('Invalid delta for migration') }
  }

  try {
    const res = await User.updateMany({}, { $inc: { pepperVersion: delta } })
    return { ok: true, result: res }
  } catch (err) {
    console.error('Failed to migrate user pepperVersion fields', err && err.message)
    return { ok: false, error: err }
  }
}

export { getPeppers, getCurrentPepper, getPepperByIndex, getLength, addPepper, addPeppers, migrateUserPepperVersions }
export default { getPeppers, getCurrentPepper, getPepperByIndex, getLength, addPepper, addPeppers, migrateUserPepperVersions }
