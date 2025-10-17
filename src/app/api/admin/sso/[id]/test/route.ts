import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/utils'

// POST /api/admin/sso/[id]/test - Test SSO provider configuration
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin permissions
    const normalizedUserId = normalizeUserId(session.user.id)
    const userWorkspace = await prisma.userWorkspace.findFirst({
      where: {
        userId: normalizedUserId,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })

    if (!userWorkspace) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get SSO provider
    const ssoProvider = await prisma.sSOProvider.findUnique({
      where: { id: params.id }
    })

    if (!ssoProvider) {
      return NextResponse.json(
        { error: 'SSO provider not found' },
        { status: 404 }
      )
    }

    if (!ssoProvider.isActive) {
      return NextResponse.json(
        { error: 'SSO provider is not active' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { testEmail } = body

    // Perform different tests based on SSO type
    let testResults: any = {
      providerId: params.id,
      providerName: ssoProvider.name,
      providerType: ssoProvider.type,
      testResults: []
    }

    try {
      // Test 1: Configuration validation
      const configTest = await testConfiguration(ssoProvider)
      testResults.testResults.push(configTest)

      // Test 2: Connection test
      const connectionTest = await testConnection(ssoProvider)
      testResults.testResults.push(connectionTest)

      // Test 3: Domain restrictions (if applicable)
      if (ssoProvider.domainRestrictions.length > 0 && testEmail) {
        const domainTest = await testDomainRestrictions(ssoProvider, testEmail)
        testResults.testResults.push(domainTest)
      }

      // Test 4: Auto-provisioning rules
      if (ssoProvider.autoProvisioning) {
        const provisioningTest = await testAutoProvisioning(ssoProvider)
        testResults.testResults.push(provisioningTest)
      }

      // Calculate overall test status
      const failedTests = testResults.testResults.filter((t: any) => t.status === 'failed')
      const warningTests = testResults.testResults.filter((t: any) => t.status === 'warning')

      testResults.overallStatus = failedTests.length > 0 ? 'failed' :
                                  warningTests.length > 0 ? 'warning' : 'passed'

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: normalizedUserId,
          workspaceId: ssoProvider.workspaceId,
          action: 'sso_provider_tested',
          resource: 'sso_provider',
          resourceId: params.id,
          metadata: {
            overallStatus: testResults.overallStatus,
            testsRun: testResults.testResults.length,
            testEmail: testEmail || null
          },
          timestamp: new Date()
        }
      })

      return NextResponse.json(testResults)
    } catch (error: any) {
      testResults.overallStatus = 'failed'
      testResults.error = error.message

      return NextResponse.json(testResults, { status: 500 })
    }
  } catch (error) {
    console.error('Failed to test SSO provider:', error)
    return NextResponse.json(
      { error: 'Failed to test SSO provider' },
      { status: 500 }
    )
  }
}

// Test configuration completeness
async function testConfiguration(provider: any): Promise<any> {
  const test = {
    name: 'Configuration Validation',
    status: 'passed',
    message: 'All required configuration fields are present',
    details: []
  }

  const requiredFields = getSSORequiredFields(provider.type)
  const missingFields = []

  for (const field of requiredFields) {
    if (!provider[field]) {
      missingFields.push(field)
    }
  }

  if (missingFields.length > 0) {
    test.status = 'failed'
    test.message = `Missing required fields: ${missingFields.join(', ')}`
    test.details = missingFields.map(field => `Missing: ${field}`)
  }

  // Check optional but recommended fields
  const recommendedFields = ['callbackUrl', 'scopes']
  const missingRecommended = recommendedFields.filter(field => !provider[field] ||
    (Array.isArray(provider[field]) && provider[field].length === 0))

  if (missingRecommended.length > 0 && test.status === 'passed') {
    test.status = 'warning'
    test.message = `Missing recommended fields: ${missingRecommended.join(', ')}`
    test.details.push(...missingRecommended.map(field => `Recommended: ${field}`))
  }

  return test
}

// Test connection to SSO provider
async function testConnection(provider: any): Promise<any> {
  const test = {
    name: 'Connection Test',
    status: 'passed',
    message: 'Connection configuration appears valid',
    details: []
  }

  try {
    // Simulate connection tests based on provider type
    switch (provider.type) {
      case 'GOOGLE':
        await testGoogleConnection(provider)
        break
      case 'MICROSOFT':
        await testMicrosoftConnection(provider)
        break
      case 'OKTA':
        await testOktaConnection(provider)
        break
      case 'SAML':
        await testSAMLConnection(provider)
        break
      case 'LDAP':
        await testLDAPConnection(provider)
        break
      default:
        test.status = 'warning'
        test.message = 'Connection test not implemented for this provider type'
    }

    test.details.push(`${provider.type} configuration validated`)
  } catch (error: any) {
    test.status = 'failed'
    test.message = `Connection test failed: ${error.message}`
    test.details.push(error.message)
  }

  return test
}

// Test domain restrictions
async function testDomainRestrictions(provider: any, testEmail: string): Promise<any> {
  const test = {
    name: 'Domain Restrictions Test',
    status: 'passed',
    message: 'Domain restrictions are properly configured',
    details: []
  }

  if (!testEmail) {
    test.status = 'warning'
    test.message = 'No test email provided for domain restriction validation'
    return test
  }

  const emailDomain = testEmail.split('@')[1]
  const allowedDomains = provider.domainRestrictions

  if (allowedDomains.length > 0) {
    const isDomainAllowed = allowedDomains.some((domain: string) =>
      emailDomain === domain || emailDomain.endsWith('.' + domain)
    )

    if (isDomainAllowed) {
      test.message = `Email domain '${emailDomain}' is allowed`
      test.details.push(`Domain '${emailDomain}' matches allowed domains: ${allowedDomains.join(', ')}`)
    } else {
      test.status = 'failed'
      test.message = `Email domain '${emailDomain}' is not allowed`
      test.details.push(`Domain '${emailDomain}' not in allowed domains: ${allowedDomains.join(', ')}`)
    }
  } else {
    test.status = 'warning'
    test.message = 'No domain restrictions configured - all domains allowed'
  }

  return test
}

// Test auto-provisioning configuration
async function testAutoProvisioning(provider: any): Promise<any> {
  const test = {
    name: 'Auto-Provisioning Test',
    status: 'passed',
    message: 'Auto-provisioning is properly configured',
    details: []
  }

  if (!provider.autoProvisioning) {
    test.status = 'warning'
    test.message = 'Auto-provisioning is disabled'
    return test
  }

  // Check if default role is valid
  const validRoles = ['OWNER', 'ADMIN', 'PUBLISHER', 'ANALYST', 'CLIENT_VIEWER']
  if (!validRoles.includes(provider.defaultRole)) {
    test.status = 'failed'
    test.message = `Invalid default role: ${provider.defaultRole}`
    test.details.push(`Default role must be one of: ${validRoles.join(', ')}`)
  } else {
    test.details.push(`Default role set to: ${provider.defaultRole}`)
  }

  return test
}

// Provider-specific connection tests (mock implementations)
async function testGoogleConnection(provider: any): Promise<void> {
  if (!provider.clientId || !provider.clientSecret) {
    throw new Error('Google OAuth requires clientId and clientSecret')
  }
  // In a real implementation, test Google OAuth endpoints
}

async function testMicrosoftConnection(provider: any): Promise<void> {
  if (!provider.clientId || !provider.clientSecret) {
    throw new Error('Microsoft OAuth requires clientId and clientSecret')
  }
  // In a real implementation, test Microsoft OAuth endpoints
}

async function testOktaConnection(provider: any): Promise<void> {
  if (!provider.clientId || !provider.clientSecret || !provider.issuerUrl) {
    throw new Error('Okta requires clientId, clientSecret, and issuerUrl')
  }
  // In a real implementation, test Okta endpoints
}

async function testSAMLConnection(provider: any): Promise<void> {
  if (!provider.issuerUrl || !provider.callbackUrl) {
    throw new Error('SAML requires issuerUrl and callbackUrl')
  }
  // In a real implementation, validate SAML metadata
}

async function testLDAPConnection(provider: any): Promise<void> {
  if (!provider.issuerUrl) {
    throw new Error('LDAP requires issuerUrl (LDAP server URL)')
  }
  // In a real implementation, test LDAP connection
}

// Helper function to get required fields for each SSO type
function getSSORequiredFields(type: string): string[] {
  switch (type) {
    case 'GOOGLE':
      return ['clientId', 'clientSecret']
    case 'MICROSOFT':
      return ['clientId', 'clientSecret']
    case 'OKTA':
      return ['clientId', 'clientSecret', 'issuerUrl']
    case 'SAML':
      return ['issuerUrl', 'callbackUrl']
    case 'LDAP':
      return ['issuerUrl']
    default:
      return ['clientId', 'clientSecret']
  }
}