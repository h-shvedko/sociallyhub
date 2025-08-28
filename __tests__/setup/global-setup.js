const { execSync } = require('child_process')

module.exports = async () => {
  console.log('🚀 Starting global test setup...')
  
  // Set test environment variables
  process.env.NODE_ENV = 'test'
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3099'
  
  // Set up test database URL if not provided
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/sociallyhub_test'
  }
  
  // Set up Redis URL for testing
  if (!process.env.REDIS_URL) {
    process.env.REDIS_URL = 'redis://localhost:6379/1' // Use database 1 for tests
  }
  
  try {
    // Run database migrations for test database
    console.log('📊 Setting up test database...')
    execSync('npx prisma migrate deploy', { 
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
    })
    
    // Generate Prisma client
    execSync('npx prisma generate', { stdio: 'inherit' })
    
    console.log('✅ Global test setup completed')
  } catch (error) {
    console.error('❌ Global test setup failed:', error.message)
    // Don't fail the tests if DB setup fails (might be running without Docker)
    console.warn('⚠️  Continuing without database setup - some tests may fail')
  }
}