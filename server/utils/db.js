import mongoose from 'mongoose'

/**
 * Tries to connect to available MongoDB URIs (cloud first, then local).
 * Returns { ok: true, uri, label, dbName } on success, or throws on failure.
 */
export async function connectToAvailableMongoDB(options = {}) {
  const uris = options.uris || [
    { uri: process.env.MONGO_URI, label: '☁️  Cloud MongoDB Atlas' },
    { uri: process.env.MONGO_URI_LOCAL, label: '💻 Local MongoDB' }
  ]

  const errors = []

  for (const { uri, label } of uris) {
    if (!uri) continue
    try {
      await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
      const dbName = uri.split('/').pop()
      console.log(`✅ Connected to ${label} — database: ${dbName}`)
      return { ok: true, uri, label, dbName }
    } catch (err) {
      errors.push({ label, message: err && err.message })
      console.warn(`⚠️ Failed to connect to ${label}: ${err && err.message}`)
    }
  }

  const err = new Error('No MongoDB instance could be reached (checked cloud and local)')
  err.details = errors
  throw err
}

export async function disconnectMongoose() {
  try {
    await mongoose.disconnect()
  } catch (err) {
    console.warn('Warning: failed to disconnect mongoose cleanly:', err && err.message)
  }
}
