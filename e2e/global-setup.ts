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
    
    // Set up test database and verify seeded data
    if (process.env.DATABASE_URL) {
      console.log('📊 Setting up test database...')
      
      // Import Prisma client for database operations
      const { PrismaClient } = require('@prisma/client')
      const prisma = new PrismaClient()
      
      try {
        // Check if database is already seeded (from CI)
        const userCount = await prisma.user.count()
        const workspaceCount = await prisma.workspace.count()
        const postCount = await prisma.post.count()
        
        console.log(`📈 Current data counts: Users: ${userCount}, Workspaces: ${workspaceCount}, Posts: ${postCount}`)
        
        // If not seeded or minimal data, seed the database
        if (userCount < 10 || workspaceCount < 5 || postCount < 50) {
          console.log('🌱 Seeding test database with mock data...')
          
          // Dynamically import and run the seed script
          const seedModule = require('../prisma/seed.ts')
          if (typeof seedModule === 'function') {
            await seedModule()
          }
          
          console.log('✅ Database seeded successfully')
          
          // Verify seeded data
          const newUserCount = await prisma.user.count()
          const newWorkspaceCount = await prisma.workspace.count()
          const newPostCount = await prisma.post.count()
          
          console.log(`📈 After seeding: Users: ${newUserCount}, Workspaces: ${newWorkspaceCount}, Posts: ${newPostCount}`)
        } else {
          console.log('✅ Database already contains sufficient test data')
          
          // Set flag to indicate data is available
          process.env.DATABASE_SEEDED = 'true'
        }
        
      } catch (error) {
        console.warn('⚠️ Database setup encountered an issue:', error.message)
        // Continue with tests even if seeding fails
      } finally {
        await prisma.$disconnect()
      }
    }
    
    console.log('✅ Playwright global setup completed')
    
  } catch (error) {
    console.error('❌ Playwright global setup failed:', error)
    throw error
  }
}

export default globalSetup