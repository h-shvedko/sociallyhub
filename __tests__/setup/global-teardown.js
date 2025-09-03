module.exports = async () => {
  console.log('🧹 Starting global test teardown...')
  
  // Clean up any global resources
  // Close database connections, cleanup files, etc.
  
  try {
    // If we have a global Prisma client, close it
    if (global.__PRISMA_CLIENT__) {
      await global.__PRISMA_CLIENT__.$disconnect()
      delete global.__PRISMA_CLIENT__
    }
    
    // Close Redis connections if any
    if (global.__REDIS_CLIENT__) {
      await global.__REDIS_CLIENT__.quit()
      delete global.__REDIS_CLIENT__
    }
    
    console.log('✅ Global test teardown completed')
  } catch (error) {
    console.error('❌ Global test teardown failed:', error.message)
  }
}