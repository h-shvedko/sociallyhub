import { PrismaClient } from '@prisma/client'
import { seedVideoTutorials } from '../lib/seeders/video-tutorial-seeder'

const prisma = new PrismaClient()

async function main() {
  console.log('🎥 Starting video tutorial seeding...')

  try {
    await seedVideoTutorials()
    console.log('✅ Video tutorial seeding completed successfully!')
  } catch (error) {
    console.error('❌ Video tutorial seeding failed:', error)
    process.exit(1)
  }
}

main()
  .catch((e) => {
    console.error('❌ Script failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })