import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth'

// Mock FAQ Templates storage (in production, this would be a database table)
const FAQ_TEMPLATES = [
  {
    id: 'login-issues',
    name: 'Login Issues',
    description: 'Template for login-related problems',
    category: 'Account',
    template: 'If you\'re having trouble logging in, please try the following steps:\n\n1. Check your email and password\n2. Clear your browser cache\n3. Try a different browser\n4. Reset your password if needed\n\nIf the problem persists, please contact our support team.',
    variables: ['{{contact_email}}', '{{reset_link}}'],
    usageCount: 45,
    lastUsed: new Date().toISOString()
  },
  {
    id: 'billing-general',
    name: 'General Billing',
    description: 'Template for billing inquiries',
    category: 'Billing',
    template: 'For billing questions, you can:\n\n1. View your invoices in the billing section\n2. Update your payment method\n3. Download receipts\n4. Contact billing support at {{billing_email}}\n\nYour current plan: {{current_plan}}',
    variables: ['{{billing_email}}', '{{current_plan}}'],
    usageCount: 32,
    lastUsed: new Date().toISOString()
  },
  {
    id: 'feature-request',
    name: 'Feature Request Response',
    description: 'Template for responding to feature requests',
    category: 'General',
    template: 'Thank you for your feature request! We appreciate your feedback.\n\nWe\'ve added your suggestion to our product roadmap for consideration. You can track the status of feature requests in our community forum.\n\nIn the meantime, here are some similar features you might find useful:\n- {{similar_feature_1}}\n- {{similar_feature_2}}',
    variables: ['{{similar_feature_1}}', '{{similar_feature_2}}', '{{roadmap_link}}'],
    usageCount: 18,
    lastUsed: new Date().toISOString()
  },
  {
    id: 'integration-help',
    name: 'Integration Setup',
    description: 'Template for integration assistance',
    category: 'Integrations',
    template: 'To set up {{integration_name}} integration:\n\n1. Go to Settings > Integrations\n2. Find {{integration_name}} and click Connect\n3. Follow the authorization process\n4. Configure your sync settings\n\nFor detailed instructions, see our {{documentation_link}}.\n\nNeed help? Contact us at {{support_email}}.',
    variables: ['{{integration_name}}', '{{documentation_link}}', '{{support_email}}'],
    usageCount: 28,
    lastUsed: new Date().toISOString()
  },
  {
    id: 'data-export',
    name: 'Data Export',
    description: 'Template for data export requests',
    category: 'Data',
    template: 'To export your data:\n\n1. Navigate to Settings > Data Export\n2. Select the data types you want to export\n3. Choose your preferred format (CSV, JSON, PDF)\n4. Click "Generate Export"\n5. Download the file when ready\n\nExports typically take {{processing_time}} to process. You\'ll receive an email notification when ready.',
    variables: ['{{processing_time}}', '{{download_link}}'],
    usageCount: 15,
    lastUsed: new Date().toISOString()
  }
]

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || ''
    const search = searchParams.get('search') || ''

    let templates = [...FAQ_TEMPLATES]

    // Filter by category
    if (category) {
      templates = templates.filter(t =>
        t.category.toLowerCase() === category.toLowerCase()
      )
    }

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase()
      templates = templates.filter(t =>
        t.name.toLowerCase().includes(searchLower) ||
        t.description.toLowerCase().includes(searchLower) ||
        t.template.toLowerCase().includes(searchLower)
      )
    }

    // Sort by usage count
    templates.sort((a, b) => b.usageCount - a.usageCount)

    return NextResponse.json({
      templates,
      stats: {
        total: FAQ_TEMPLATES.length,
        categories: [...new Set(FAQ_TEMPLATES.map(t => t.category))].length,
        totalUsage: FAQ_TEMPLATES.reduce((sum, t) => sum + t.usageCount, 0)
      }
    })

  } catch (error) {
    console.error('Error fetching FAQ templates:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, category, template, variables = [] } = body

    if (!name || !template) {
      return NextResponse.json(
        { error: 'Name and template are required' },
        { status: 400 }
      )
    }

    // Generate ID from name
    const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

    // Check if template with same ID exists
    const existingIndex = FAQ_TEMPLATES.findIndex(t => t.id === id)
    if (existingIndex >= 0) {
      return NextResponse.json(
        { error: 'Template with this name already exists' },
        { status: 409 }
      )
    }

    const newTemplate = {
      id,
      name,
      description: description || '',
      category: category || 'General',
      template,
      variables: Array.isArray(variables) ? variables : [],
      usageCount: 0,
      lastUsed: new Date().toISOString()
    }

    FAQ_TEMPLATES.push(newTemplate)

    return NextResponse.json({
      message: 'Template created successfully',
      template: newTemplate
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating FAQ template:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}