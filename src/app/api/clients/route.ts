import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { withLogging } from '@/lib/middleware/logging'
import { BusinessLogger } from '@/lib/middleware/logging'

async function getClientsHandler(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    // Mock client data - in real implementation, this would fetch from database
    const mockClients = [
      {
        id: '1',
        workspaceId,
        name: 'Acme Corporation',
        email: 'contact@acme.com',
        phone: '+1 (555) 123-4567',
        company: 'Acme Corporation',
        industry: 'Technology',
        website: 'https://acme.com',
        status: 'ACTIVE',
        onboardingStatus: 'COMPLETED',
        createdAt: new Date('2024-01-15').toISOString(),
        updatedAt: new Date('2024-01-20').toISOString(),
        lastContactDate: new Date('2024-01-18').toISOString(),
        assignedUserId: 'user1',
        tags: ['Enterprise', 'Priority'],
        notes: 'High-value client with complex requirements',
        contractDetails: {
          startDate: new Date('2024-01-01').toISOString(),
          endDate: new Date('2024-12-31').toISOString(),
          contractType: 'ANNUAL',
          serviceLevel: 'PREMIUM',
          included: {
            socialAccounts: 10,
            monthlyPosts: 100,
            teamMembers: 8,
            analyticsReports: true,
            prioritySupport: true,
            customBranding: true,
            whiteLabel: true,
            apiAccess: true,
            advancedFeatures: ['Custom Analytics', 'White Label']
          }
        },
        billingInfo: {
          contractValue: 12000,
          currency: 'USD',
          billingCycle: 'ANNUAL',
          paymentTerms: 30,
          nextBillingDate: new Date('2025-01-01').toISOString()
        }
      },
      {
        id: '2',
        workspaceId,
        name: 'TechStart Inc.',
        email: 'hello@techstart.io',
        phone: '+1 (555) 987-6543',
        company: 'TechStart Inc.',
        industry: 'Technology',
        website: 'https://techstart.io',
        status: 'ACTIVE',
        onboardingStatus: 'IN_PROGRESS',
        createdAt: new Date('2024-01-20').toISOString(),
        updatedAt: new Date('2024-01-22').toISOString(),
        assignedUserId: 'user2',
        tags: ['Startup'],
        contractDetails: {
          startDate: new Date('2024-01-20').toISOString(),
          contractType: 'MONTHLY',
          serviceLevel: 'STANDARD',
          included: {
            socialAccounts: 5,
            monthlyPosts: 50,
            teamMembers: 3,
            analyticsReports: true,
            prioritySupport: false,
            customBranding: false,
            whiteLabel: false,
            apiAccess: false,
            advancedFeatures: []
          }
        },
        billingInfo: {
          contractValue: 599,
          currency: 'USD',
          billingCycle: 'MONTHLY',
          paymentTerms: 15,
          nextBillingDate: new Date('2024-02-20').toISOString()
        }
      }
    ]

    // Apply filters
    let filteredClients = mockClients
    if (status && status !== 'all') {
      filteredClients = filteredClients.filter(client => client.status === status)
    }
    if (search) {
      const searchLower = search.toLowerCase()
      filteredClients = filteredClients.filter(client =>
        client.name.toLowerCase().includes(searchLower) ||
        client.email.toLowerCase().includes(searchLower) ||
        client.company?.toLowerCase().includes(searchLower)
      )
    }

    // Apply pagination
    const offset = (page - 1) * limit
    const paginatedClients = filteredClients.slice(offset, offset + limit)

    BusinessLogger.logClientListViewed(session.user.id, workspaceId, {
      totalClients: filteredClients.length,
      filters: { status, search }
    })

    return NextResponse.json({
      clients: paginatedClients,
      totalCount: filteredClients.length,
      page,
      pageSize: limit,
      totalPages: Math.ceil(filteredClients.length / limit)
    })
  } catch (error) {
    console.error('Error fetching clients:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function createClientHandler(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      workspaceId,
      name,
      email,
      phone,
      company,
      industry,
      website,
      assignedUserId,
      tags,
      notes,
      contractDetails,
      billingInfo
    } = body

    if (!workspaceId || !name || !email) {
      return NextResponse.json({ 
        error: 'Missing required fields: workspaceId, name, email' 
      }, { status: 400 })
    }

    // Mock client creation - in real implementation, this would save to database
    const newClient = {
      id: `client_${Date.now()}`,
      workspaceId,
      name,
      email,
      phone,
      company,
      industry,
      website,
      status: 'PROSPECT',
      onboardingStatus: 'NOT_STARTED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assignedUserId,
      tags: tags || [],
      notes,
      contractDetails,
      billingInfo
    }

    BusinessLogger.logClientCreated(newClient.id, session.user.id, workspaceId)

    return NextResponse.json(newClient, { status: 201 })
  } catch (error) {
    console.error('Error creating client:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const GET = withLogging(getClientsHandler, 'clients-list')
export const POST = withLogging(createClientHandler, 'clients-create')