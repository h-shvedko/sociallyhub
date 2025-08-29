import { prisma } from "@/lib/prisma"
import { User } from "@prisma/client"

/**
 * Get the demo user from the database
 * This ensures we always use the actual database user instead of hardcoded IDs
 */
export async function getDemoUser(): Promise<User | null> {
  try {
    const demoUser = await prisma.user.findUnique({
      where: {
        email: 'demo@sociallyhub.com'
      }
    })
    return demoUser
  } catch (error) {
    console.error('Failed to fetch demo user:', error)
    return null
  }
}

/**
 * Get the demo user ID from the database
 */
export async function getDemoUserId(): Promise<string | null> {
  const demoUser = await getDemoUser()
  return demoUser?.id || null
}

/**
 * Check if a user ID is the demo user
 * This handles both the old hardcoded ID and the actual database ID
 */
export async function isDemoUser(userId: string): Promise<boolean> {
  // Legacy hardcoded IDs that might still be in sessions
  const legacyDemoIds = ['demo-user-id', 'cmesceft00000r6gjl499x7dl']
  
  if (legacyDemoIds.includes(userId)) {
    return true
  }
  
  // Check against actual database
  const demoUser = await getDemoUser()
  return demoUser?.id === userId
}

/**
 * Normalize user ID - converts legacy demo IDs to actual database ID
 */
export async function normalizeUserId(userId: string): Promise<string> {
  const legacyDemoIds = ['demo-user-id', 'cmesceft00000r6gjl499x7dl']
  
  if (legacyDemoIds.includes(userId)) {
    const demoUserId = await getDemoUserId()
    return demoUserId || userId
  }
  
  return userId
}