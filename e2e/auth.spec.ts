import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start from the sign-in page
    await page.goto('/auth/signin')
  })

  test('should display sign-in form', async ({ page }) => {
    // Check if the sign-in form is displayed
    await expect(page.locator('h1')).toContainText('Sign In')
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('should show validation errors for empty fields', async ({ page }) => {
    // Try to submit form without filling fields
    await page.click('button[type="submit"]')
    
    // Check for validation errors
    await expect(page.locator('text=Email is required')).toBeVisible()
    await expect(page.locator('text=Password is required')).toBeVisible()
  })

  test('should show error for invalid credentials', async ({ page }) => {
    // Fill form with invalid credentials
    await page.fill('input[name="email"]', 'invalid@example.com')
    await page.fill('input[name="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')
    
    // Check for error message
    await expect(page.locator('text=Invalid email or password')).toBeVisible()
  })

  test('should successfully sign in with valid credentials', async ({ page }) => {
    // Fill form with valid demo credentials
    await page.fill('input[name="email"]', 'demo@sociallyhub.com')
    await page.fill('input[name="password"]', 'demo123456')
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard')
    
    // Should display user information
    await expect(page.locator('text=Welcome')).toBeVisible()
  })

  test('should navigate to sign-up page', async ({ page }) => {
    // Click sign-up link
    await page.click('text=Don\'t have an account?')
    
    // Should navigate to sign-up page
    await expect(page).toHaveURL('/auth/signup')
    await expect(page.locator('h1')).toContainText('Sign Up')
  })

  test('should remember me functionality work', async ({ page }) => {
    // Fill credentials and check remember me
    await page.fill('input[name="email"]', 'demo@sociallyhub.com')
    await page.fill('input[name="password"]', 'demo123456')
    await page.check('input[name="rememberMe"]')
    
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/dashboard')
    
    // Clear session storage and refresh
    await page.evaluate(() => sessionStorage.clear())
    await page.reload()
    
    // Should still be authenticated due to remember me
    await expect(page).toHaveURL('/dashboard')
  })

  test('should handle loading state during sign-in', async ({ page }) => {
    // Fill form
    await page.fill('input[name="email"]', 'demo@sociallyhub.com')
    await page.fill('input[name="password"]', 'demo123456')
    
    // Click submit and immediately check loading state
    const submitButton = page.locator('button[type="submit"]')
    await submitButton.click()
    
    // Button should show loading state
    await expect(submitButton).toBeDisabled()
    await expect(submitButton).toContainText('Signing in...')
  })
})

test.describe('Sign Up Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/signup')
  })

  test('should display sign-up form', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Sign Up')
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
    await expect(page.locator('input[name="name"]')).toBeVisible()
    await expect(page.locator('input[name="acceptTerms"]')).toBeVisible()
  })

  test('should validate required fields', async ({ page }) => {
    await page.click('button[type="submit"]')
    
    await expect(page.locator('text=Name is required')).toBeVisible()
    await expect(page.locator('text=Email is required')).toBeVisible()
    await expect(page.locator('text=Password is required')).toBeVisible()
    await expect(page.locator('text=You must accept the terms')).toBeVisible()
  })

  test('should validate email format', async ({ page }) => {
    await page.fill('input[name="email"]', 'invalid-email')
    await page.click('button[type="submit"]')
    
    await expect(page.locator('text=Please enter a valid email')).toBeVisible()
  })

  test('should validate password strength', async ({ page }) => {
    await page.fill('input[name="password"]', '123')
    await page.click('button[type="submit"]')
    
    await expect(page.locator('text=Password must be at least 8 characters')).toBeVisible()
  })

  test('should successfully create account', async ({ page }) => {
    // Fill form with valid data
    await page.fill('input[name="name"]', 'Test User')
    await page.fill('input[name="email"]', 'testuser@example.com')
    await page.fill('input[name="password"]', 'SecurePass123!')
    await page.check('input[name="acceptTerms"]')
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Should show success message or redirect
    await expect(page.locator('text=Account created successfully')).toBeVisible()
  })
})

test.describe('Protected Routes', () => {
  test('should redirect to sign-in when accessing protected route without auth', async ({ page }) => {
    // Try to access dashboard without authentication
    await page.goto('/dashboard')
    
    // Should redirect to sign-in
    await expect(page).toHaveURL('/auth/signin')
  })

  test('should allow access to protected routes when authenticated', async ({ page }) => {
    // Use saved authentication state
    await page.goto('/auth/signin')
    await page.fill('input[name="email"]', 'demo@sociallyhub.com')
    await page.fill('input[name="password"]', 'demo123456')
    await page.click('button[type="submit"]')
    
    // Should be able to access dashboard
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/dashboard')
    
    // Should be able to access other protected routes
    await page.goto('/dashboard/posts')
    await expect(page).toHaveURL('/dashboard/posts')
  })
})

test.describe('Sign Out', () => {
  test('should sign out successfully', async ({ page }) => {
    // Sign in first
    await page.goto('/auth/signin')
    await page.fill('input[name="email"]', 'demo@sociallyhub.com')
    await page.fill('input[name="password"]', 'demo123456')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/dashboard')
    
    // Sign out
    await page.click('[data-testid="user-menu"]')
    await page.click('text=Sign Out')
    
    // Should redirect to sign-in page
    await expect(page).toHaveURL('/auth/signin')
    
    // Should not be able to access protected routes
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/auth/signin')
  })
})