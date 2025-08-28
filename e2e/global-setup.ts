import { chromium, FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting Playwright global setup...')
  
  const { baseURL } = config.projects[0].use
  
  // Set test environment variables
  process.env.NODE_ENV = 'test'
  process.env.NEXT_PUBLIC_APP_URL = baseURL || 'http://localhost:3099'
  
  try {
    // Launch browser to warm up and verify server is running
    const browser = await chromium.launch()
    const page = await browser.newPage()
    
    // Wait for server to be ready
    let retries = 10
    while (retries > 0) {
      try {
        await page.goto(baseURL || 'http://localhost:3099', { timeout: 5000 })
        console.log('✅ Server is ready for testing')
        break
      } catch (error) {
        retries--
        if (retries === 0) {
          throw new Error(`Server not ready after maximum retries: ${error}`)
        }
        console.log(`⏳ Waiting for server to be ready... (${retries} retries left)`)
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
    
    // Perform authentication for authenticated tests
    await page.goto('/auth/signin')
    
    // Use demo credentials for testing
    await page.fill('input[name="email"]', 'demo@sociallyhub.com')
    await page.fill('input[name="password"]', 'demo123456')
    await page.click('button[type="submit"]')
    
    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard', { timeout: 10000 })
    
    // Save authenticated state
    await page.context().storageState({ path: 'e2e/auth.json' })
    console.log('✅ Authentication state saved')
    
    await browser.close()
    
    // Set up test database if needed
    if (process.env.DATABASE_URL) {
      console.log('📊 Setting up test database...')
      // Run any database setup/seeding here
    }
    
    console.log('✅ Playwright global setup completed')
    
  } catch (error) {
    console.error('❌ Playwright global setup failed:', error)
    throw error
  }
}

export default globalSetup