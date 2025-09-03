import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { withLogging } from '@/lib/middleware/logging'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

async function getSettingsHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: clientId } = await params
    const userId = await normalizeUserId(session.user.id)

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
      },
      select: {
        workspaceId: true
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace access' }, { status: 403 })
    }

    // Get client settings
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        workspaceId: userWorkspace.workspaceId
      },
      select: {
        id: true,
        name: true,
        status: true,
        industry: true,
        settings: true
      }
    })

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    return NextResponse.json({
      clientId: client.id,
      clientName: client.name,
      status: client.status,
      industry: client.industry,
      settings: client.settings || {}
    })
  } catch (error) {
    console.error('Error fetching client settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function updateSettingsHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: clientId } = await params
    const body = await req.json()
    const { 
      status,
      industry,
      timezone,
      language,
      emailNotifications,
      smsNotifications,
      marketingEmails,
      weeklyReports,
      monthlyReports,
      autoRenewal,
      dataRetention,
      exportFormat,
      portalAccess,
      reportingAccess,
      campaignAccess,
      customFields,
      notes
    } = body

    const userId = await normalizeUserId(session.user.id)

    // Get user's workspace
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId,
        role: { in: ['OWNER', 'ADMIN', 'PUBLISHER'] }
      },
      select: {
        workspaceId: true
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'No workspace access' }, { status: 403 })
    }

    // Verify client exists and belongs to workspace
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        workspaceId: userWorkspace.workspaceId
      }
    })

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Prepare settings data
    const settingsData = {
      // Profile settings
      timezone: timezone || 'UTC',
      language: language || 'en',
      
      // Communication preferences
      notifications: {
        email: emailNotifications !== undefined ? emailNotifications : true,
        sms: smsNotifications !== undefined ? smsNotifications : false,
        marketing: marketingEmails !== undefined ? marketingEmails : true,
        weeklyReports: weeklyReports !== undefined ? weeklyReports : true,
        monthlyReports: monthlyReports !== undefined ? monthlyReports : true
      },
      
      // Account settings
      account: {
        autoRenewal: autoRenewal !== undefined ? autoRenewal : true,
        dataRetention: dataRetention || '24',
        exportFormat: exportFormat || 'pdf'
      },
      
      // Access controls
      access: {
        portal: portalAccess !== undefined ? portalAccess : true,
        reporting: reportingAccess !== undefined ? reportingAccess : true,
        campaigns: campaignAccess !== undefined ? campaignAccess : false
      },
      
      // Custom fields
      customFields: customFields || [],
      
      // Metadata
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    }

    // Update client with new settings
    const updatedClient = await prisma.client.update({
      where: {
        id: clientId
      },
      data: {
        status: status || client.status,
        industry: industry || client.industry,
        notes: notes !== undefined ? notes : client.notes,
        settings: settingsData
      },
      include: {
        workspace: {
          select: {
            name: true
          }
        }
      }
    })

    console.log('✅ Client settings updated successfully:', {
      clientName: updatedClient.name,
      status: updatedClient.status,
      industry: updatedClient.industry,
      settingsKeys: Object.keys(settingsData)
    })

    // Log settings change for audit trail
    await prisma.inboxItem.create({
      data: {
        workspaceId: userWorkspace.workspaceId,
        type: 'SYSTEM_LOG',
        content: `Client settings updated for ${updatedClient.name}`,
        status: 'PROCESSED',
        priority: 'LOW',
        metadata: {
          clientId: clientId,
          clientName: updatedClient.name,
          action: 'SETTINGS_UPDATE',
          changedBy: userId,
          changes: {
            status: status !== client.status ? { from: client.status, to: status } : null,
            industry: industry !== client.industry ? { from: client.industry, to: industry } : null,
            settingsUpdated: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Client settings updated successfully',
      clientId: updatedClient.id,
      clientName: updatedClient.name,
      status: updatedClient.status,
      industry: updatedClient.industry,
      settings: settingsData
    })
  } catch (error) {
    console.error('Error updating client settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const GET = withLogging(getSettingsHandler, 'client-settings-get')
export const POST = withLogging(updateSettingsHandler, 'client-settings-update')