import { FullConfig } from '@playwright/test'

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting Playwright global teardown...')
  
  try {
    // Clean up test data
    if (process.env.DATABASE_URL) {
      console.log('🗄️ Cleaning up test database...')
      // Clean up test database here
    }
    
    // Clean up temporary files
    const fs = require('fs')
    const path = require('path')
    
    // Remove auth state file
    const authFile = path.join(__dirname, 'auth.json')
    if (fs.existsSync(authFile)) {
      fs.unlinkSync(authFile)
      console.log('🗑️ Removed authentication state file')
    }
    
    // Clean up screenshots and videos from previous runs if needed
    const testResultsDir = path.join(process.cwd(), 'test-results')
    if (fs.existsSync(testResultsDir)) {
      console.log('🗑️ Cleaning up old test results...')
      // Optionally clean up old test results
    }
    
    console.log('✅ Playwright global teardown completed')
    
  } catch (error) {
    console.error('❌ Playwright global teardown failed:', error)
    // Don't throw here as it might mask test failures
  }
}

export default globalTeardown