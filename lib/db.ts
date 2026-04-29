import { neon } from '@neondatabase/serverless'

let _sql: ReturnType<typeof neon> | undefined

export default function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  if (!_sql) {
    _sql = neon(process.env.DATABASE_URL!)
  }
  return _sql(strings, ...values)
}
