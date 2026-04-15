require('dotenv').config()
const path = require('path')

// Load .env.local explicitly
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })
}

const bcrypt = require('bcryptjs')
const { neon } = require('@neondatabase/serverless')

async function main() {
  const sql = neon(process.env.DATABASE_URL)

  // Generate a real bcrypt hash for "admin123"
  const hash = await bcrypt.hash('admin123', 10)
  console.log('[v0] Generated hash:', hash)

  // Create tables if they don't exist yet
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS folders (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS files (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      blob_url TEXT NOT NULL,
      folder_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
      uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      size_bytes INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS folder_permissions (
      id SERIAL PRIMARY KEY,
      folder_id INTEGER REFERENCES folders(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(folder_id, user_id)
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  // Upsert admin user with real hash
  await sql`
    INSERT INTO users (name, email, password_hash, role)
    VALUES ('Administrador', 'admin@samtech.cl', ${hash}, 'admin')
    ON CONFLICT (email) DO UPDATE
      SET password_hash = ${hash},
          role = 'admin',
          name = 'Administrador'
  `

  console.log('[v0] Admin user created/updated successfully')
  console.log('[v0] Email: admin@samtech.cl')
  console.log('[v0] Password: admin123')
}

main().catch((err) => {
  console.error('[v0] Error:', err)
  process.exit(1)
})
