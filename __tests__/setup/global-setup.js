/**
 * Global Jest setup (ADR-0021): cheap env defaults ONLY.
 *
 * The old version shelled out to `prisma migrate deploy` + `prisma generate`
 * on every test run — slow, env-fragile, and pointless for unit/component
 * tests that never touch a database. Suites that need a DB must manage it
 * explicitly (Track D owns __tests__/api).
 */
module.exports = async () => {
  process.env.NEXT_PUBLIC_APP_URL ||= 'http://localhost:3099'
  process.env.NEXTAUTH_URL ||= 'http://localhost:3099'
  process.env.NEXTAUTH_SECRET ||= 'test-secret'
  process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/sociallyhub_test'
  process.env.REDIS_URL ||= 'redis://localhost:6379/1'

  console.log(
    '[jest global-setup] env defaults applied (no DB migration/seeding here — suites that need a DB manage it themselves)'
  )
}
