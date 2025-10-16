import { seedHelpContent } from '../src/lib/seeders/help-content-seeder'

async function main() {
  console.log('🌱 Seeding help content only...')
  try {
    await seedHelpContent()
    console.log('✅ Help content seeding completed!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error seeding help content:', error)
    process.exit(1)
  }
}

main()