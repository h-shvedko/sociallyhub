/**
 * Demo Mode Configuration
 * 
 * This file contains configuration for demo mode functionality.
 * In production, demo mode should be disabled.
 */

export const demoConfig = {
  // Enable demo mode only in development environment
  enabled: process.env.NODE_ENV === 'development' || process.env.ENABLE_DEMO === 'true',
  
  // Demo user configuration (used for display purposes only)
  demoUser: {
    email: 'demo@sociallyhub.com',
    displayName: 'Demo User',
    message: 'Use demo@sociallyhub.com / demo123456 to sign in'
  },
  
  // Environment checks
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
}

/**
 * Check if demo mode is enabled
 */
export function isDemoMode(): boolean {
  return demoConfig.enabled
}

/**
 * Get demo credentials message for login page
 */
export function getDemoCredentialsMessage(): string | null {
  if (!isDemoMode()) return null
  return demoConfig.demoUser.message
}