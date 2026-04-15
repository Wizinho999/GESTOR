import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import bcrypt from 'bcryptjs'
import { neon } from '@neondatabase/serverless'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')

// Load .env.local explicitly
dotenv.config({ path: envPath })

const sql = neon(process.env.DATABASE_URL)

async function main() {
  const password = 'admin123'
  const hash = await bcrypt.hash(password, 10)

  console.log('[v0] Generated hash:', hash)

  await sql`
    INSERT INTO users (name, email, password_hash, role)
    VALUES ('Administrador', 'admin@samtech.cl', ${hash}, 'admin')
    ON CONFLICT (email) DO UPDATE SET password_hash = ${hash}, role = 'admin'
  `

  console.log('[v0] Admin user upserted successfully!')
  console.log('[v0] Credentials: admin@samtech.cl / admin123')
}

main().catch((err) => {
  console.error('[v0] Error seeding admin:', err)
  process.exit(1)
})
