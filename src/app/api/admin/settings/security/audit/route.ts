import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/utils'

// POST /api/admin/settings/security/audit - Run security audit
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const body = await request.json()
    const { workspaceId, categories, configurationIds } = body

    // Check workspace permissions if specified
    if (workspaceId) {
      const userWorkspace = await prisma.userWorkspace.findFirst({
        where: {
          userId: normalizedUserId,
          workspaceId: workspaceId,
          role: { in: ['OWNER', 'ADMIN'] }
        }
      })

      if (!userWorkspace) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Build query for configurations to audit
    const where: any = {
      workspaceId: workspaceId || null,
      isEnabled: true
    }

    if (categories && categories.length > 0) {
      where.category = { in: categories }
    }

    if (configurationIds && configurationIds.length > 0) {
      where.id = { in: configurationIds }
    }

    const configurations = await prisma.securityConfiguration.findMany({
      where
    })

    // Mock security audit implementation
    const auditConfiguration = async (config: any) => {
      // Simulate audit delay
      await new Promise(resolve => setTimeout(resolve, 100))

      // Mock audit logic based on category and setting
      const auditRules: Record<string, (value: string, recommended?: string) => { result: string; details: string }> = {
        PASSWORD_POLICY: (value, recommended) => {
          try {
            const policy = JSON.parse(value)
            const issues = []

            if (policy.minLength < 8) issues.push('Minimum length below 8 characters')
            if (!policy.requireUppercase) issues.push('Uppercase letters not required')
            if (!policy.requireLowercase) issues.push('Lowercase letters not required')
            if (!policy.requireNumbers) issues.push('Numbers not required')
            if (!policy.requireSymbols) issues.push('Special characters not required')
            if (policy.maxAge > 90) issues.push('Password age exceeds 90 days')

            return {
              result: issues.length === 0 ? 'PASS' : issues.length <= 2 ? 'WARNING' : 'FAIL',
              details: issues.length === 0
                ? 'Password policy meets security standards'
                : `Issues found: ${issues.join(', ')}`
            }
          } catch {
            return { result: 'FAIL', details: 'Invalid password policy configuration' }
          }
        },

        SESSION_MANAGEMENT: (value, recommended) => {
          try {
            const session = JSON.parse(value)
            const issues = []

            if (session.timeout > 3600) issues.push('Session timeout exceeds 1 hour')
            if (!session.httpOnly) issues.push('HttpOnly flag not set')
            if (!session.secure) issues.push('Secure flag not set')
            if (!session.sameSite || session.sameSite === 'None') issues.push('SameSite policy too permissive')

            return {
              result: issues.length === 0 ? 'PASS' : issues.length <= 1 ? 'WARNING' : 'FAIL',
              details: issues.length === 0
                ? 'Session management configuration is secure'
                : `Issues found: ${issues.join(', ')}`
            }
          } catch {
            return { result: 'FAIL', details: 'Invalid session configuration' }
          }
        },

        ENCRYPTION: (value, recommended) => {
          const algorithm = value.toLowerCase()
          if (algorithm.includes('aes-256') || algorithm.includes('chacha20')) {
            return { result: 'PASS', details: 'Strong encryption algorithm in use' }
          } else if (algorithm.includes('aes-128')) {
            return { result: 'WARNING', details: 'Consider upgrading to AES-256' }
          } else {
            return { result: 'FAIL', details: 'Weak or outdated encryption algorithm' }
          }
        },

        API_SECURITY: (value, recommended) => {
          try {
            const api = JSON.parse(value)
            const issues = []

            if (!api.rateLimit || api.rateLimit.requests > 1000) issues.push('Rate limiting too permissive')
            if (!api.authentication || api.authentication === 'none') issues.push('Authentication not enforced')
            if (!api.cors || api.cors === '*') issues.push('CORS policy too permissive')
            if (!api.https) issues.push('HTTPS not enforced')

            return {
              result: issues.length === 0 ? 'PASS' : issues.length <= 2 ? 'WARNING' : 'FAIL',
              details: issues.length === 0
                ? 'API security configuration is adequate'
                : `Issues found: ${issues.join(', ')}`
            }
          } catch {
            return { result: 'FAIL', details: 'Invalid API security configuration' }
          }
        }
      }

      // Get audit rule for the configuration category
      const auditRule = auditRules[config.category]
      const audit = auditRule
        ? auditRule(config.value, config.recommendedValue)
        : {
            result: 'PASS',
            details: `Configuration reviewed - no specific audit rules for ${config.category}`
          }

      return {
        configurationId: config.id,
        category: config.category,
        setting: config.setting,
        auditResult: audit.result,
        auditDetails: audit.details,
        timestamp: new Date()
      }
    }

    // Run audits
    const auditResults = await Promise.all(
      configurations.map(config => auditConfiguration(config))
    )

    // Update configurations with audit results
    const updatePromises = auditResults.map(result =>
      prisma.securityConfiguration.update({
        where: { id: result.configurationId },
        data: {
          lastAudit: result.timestamp,
          auditResult: result.auditResult,
          lastUpdatedBy: normalizedUserId
        }
      })
    )

    await Promise.all(updatePromises)

    // Generate audit summary
    const summary = {
      totalAudited: auditResults.length,
      passed: auditResults.filter(r => r.auditResult === 'PASS').length,
      warnings: auditResults.filter(r => r.auditResult === 'WARNING').length,
      failed: auditResults.filter(r => r.auditResult === 'FAIL').length,
      auditTimestamp: new Date(),
      auditedBy: {
        id: normalizedUserId,
        name: session.user.name,
        email: session.user.email
      }
    }

    // Calculate new security score
    const totalScored = summary.passed + summary.warnings + summary.failed
    const securityScore = totalScored > 0
      ? Math.round(((summary.passed * 1.0) + (summary.warnings * 0.5)) / totalScored * 100)
      : 100

    return NextResponse.json({
      summary: {
        ...summary,
        securityScore
      },
      results: auditResults,
      recommendations: generateRecommendations(auditResults)
    })

  } catch (error) {
    console.error('Failed to run security audit:', error)
    return NextResponse.json(
      { error: 'Failed to run security audit' },
      { status: 500 }
    )
  }
}

// Generate security recommendations based on audit results
function generateRecommendations(auditResults: any[]) {
  const recommendations = []

  const failedAudits = auditResults.filter(r => r.auditResult === 'FAIL')
  const warningAudits = auditResults.filter(r => r.auditResult === 'WARNING')

  if (failedAudits.length > 0) {
    recommendations.push({
      priority: 'HIGH',
      type: 'CRITICAL_SECURITY_ISSUES',
      title: `${failedAudits.length} Critical Security Issues Found`,
      description: 'Immediate attention required for failed security configurations',
      actions: failedAudits.map(audit => ({
        category: audit.category,
        setting: audit.setting,
        issue: audit.auditDetails,
        action: 'Review and update configuration to meet security standards'
      }))
    })
  }

  if (warningAudits.length > 0) {
    recommendations.push({
      priority: 'MEDIUM',
      type: 'SECURITY_IMPROVEMENTS',
      title: `${warningAudits.length} Security Improvements Recommended`,
      description: 'Consider implementing these security enhancements',
      actions: warningAudits.map(audit => ({
        category: audit.category,
        setting: audit.setting,
        issue: audit.auditDetails,
        action: 'Consider implementing recommended security improvements'
      }))
    })
  }

  // Category-specific recommendations
  const passwordPolicyAudits = auditResults.filter(r => r.category === 'PASSWORD_POLICY')
  if (passwordPolicyAudits.some(a => a.auditResult !== 'PASS')) {
    recommendations.push({
      priority: 'MEDIUM',
      type: 'PASSWORD_POLICY',
      title: 'Password Policy Enhancement',
      description: 'Strengthen password requirements to improve account security',
      actions: [
        'Implement minimum 12-character password length',
        'Require mix of uppercase, lowercase, numbers, and symbols',
        'Enable password expiration (90 days maximum)',
        'Implement password history to prevent reuse'
      ]
    })
  }

  const encryptionAudits = auditResults.filter(r => r.category === 'ENCRYPTION')
  if (encryptionAudits.some(a => a.auditResult === 'WARNING' || a.auditResult === 'FAIL')) {
    recommendations.push({
      priority: 'HIGH',
      type: 'ENCRYPTION',
      title: 'Encryption Standards Update',
      description: 'Upgrade to modern encryption standards for data protection',
      actions: [
        'Migrate to AES-256 encryption for data at rest',
        'Implement TLS 1.3 for data in transit',
        'Use strong key derivation functions (PBKDF2, scrypt, or Argon2)',
        'Regular key rotation schedule'
      ]
    })
  }

  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'LOW',
      type: 'MAINTENANCE',
      title: 'Security Posture Excellent',
      description: 'All audited configurations meet security standards',
      actions: [
        'Continue regular security audits',
        'Monitor for new security best practices',
        'Review configurations quarterly'
      ]
    })
  }

  return recommendations
}