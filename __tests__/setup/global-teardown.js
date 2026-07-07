/**
 * Global Jest teardown (ADR-0021): nothing to clean up — global-setup only
 * sets env defaults. Kept as a hook point for suites that register
 * global.__PRISMA_CLIENT__ / global.__REDIS_CLIENT__.
 */
module.exports = async () => {
  try {
    if (global.__PRISMA_CLIENT__) {
      await global.__PRISMA_CLIENT__.$disconnect()
      delete global.__PRISMA_CLIENT__
    }
    if (global.__REDIS_CLIENT__) {
      await global.__REDIS_CLIENT__.quit()
      delete global.__REDIS_CLIENT__
    }
  } catch (error) {
    console.error('[jest global-teardown] cleanup failed:', error.message)
  }
}
