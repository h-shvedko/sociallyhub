import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function updateClientEmails() {
  console.log('🔍 Checking and updating client emails...')
  
  try {
    // First, let's see what clients we have
    const clients = await prisma.client.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        company: true,
        phone: true
      }
    })
    
    console.log('\n📋 Current clients in database:')
    clients.forEach(client => {
      console.log(`- ${client.name}: email="${client.email || 'NO EMAIL'}", phone="${client.phone || 'none'}"`)
    })
    
    // Update clients that don't have emails based on their names
    const updates = [
      { 
        name: 'Acme Corporation',
        data: {
          email: 'contact@acmecorp.com',
          company: 'Acme Corporation',
          industry: 'Technology',
          website: 'https://acmecorp.com',
          phone: '+1 (555) 123-4567'
        }
      },
      {
        name: 'TechStart Inc.',
        data: {
          email: 'hello@techstart.io',
          company: 'TechStart Inc.',
          industry: 'Technology',
          website: 'https://techstart.io',
          phone: '+1 (555) 987-6543'
        }
      },
      {
        name: 'Global Retail Co.',
        data: {
          email: 'marketing@globalretail.com',
          company: 'Global Retail Co.',
          industry: 'Retail',
          website: 'https://globalretail.com',
          phone: '+1 (555) 555-0123'
        }
      },
      {
        name: 'Healthcare Plus',
        data: {
          email: 'info@healthcareplus.org',
          company: 'Healthcare Plus',
          industry: 'Healthcare',
          website: 'https://healthcareplus.org',
          phone: '+1 (555) 234-5678'
        }
      },
      {
        name: 'EduLearn Systems',
        data: {
          email: 'support@edulearn.edu',
          company: 'EduLearn Systems',
          industry: 'Education',
          website: 'https://edulearn.edu',
          phone: '+1 (555) 345-6789'
        }
      }
    ]
    
    console.log('\n✏️ Updating clients without emails...')
    
    for (const update of updates) {
      const result = await prisma.client.updateMany({
        where: {
          name: update.name,
          OR: [
            { email: null },
            { email: '' }
          ]
        },
        data: update.data
      })
      
      if (result.count > 0) {
        console.log(`✅ Updated ${update.name} with email: ${update.data.email}`)
      }
    }
    
    // Also update any client that still has no email with a generic one
    const clientsWithoutEmail = await prisma.client.findMany({
      where: {
        OR: [
          { email: null },
          { email: '' }
        ]
      }
    })
    
    if (clientsWithoutEmail.length > 0) {
      console.log('\n🔧 Found clients still without emails, adding generic emails:')
      for (const client of clientsWithoutEmail) {
        const genericEmail = `${client.name.toLowerCase().replace(/\s+/g, '.')}@example.com`
        await prisma.client.update({
          where: { id: client.id },
          data: { 
            email: genericEmail,
            company: client.company || client.name,
            phone: client.phone || '+1 (555) 000-0000'
          }
        })
        console.log(`✅ Updated ${client.name} with generic email: ${genericEmail}`)
      }
    }
    
    // Final check
    const finalClients = await prisma.client.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true
      }
    })
    
    console.log('\n📊 Final client emails:')
    finalClients.forEach(client => {
      console.log(`✅ ${client.name}: ${client.email} (${client.phone || 'no phone'})`)
    })
    
    console.log('\n✨ Client email update complete!')
    
  } catch (error) {
    console.error('❌ Error updating client emails:', error)
  } finally {
    await prisma.$disconnect()
  }
}

updateClientEmails()