import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/utils'

// POST /api/admin/settings/performance/optimize - Run performance optimization
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const body = await request.json()
    const { workspaceId, categories, configurationIds, dryRun = false } = body

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

    // Build query for configurations to optimize
    const where: any = {
      workspaceId: workspaceId || null,
      isAutoTuning: true
    }

    if (categories && categories.length > 0) {
      where.category = { in: categories }
    }

    if (configurationIds && configurationIds.length > 0) {
      where.id = { in: configurationIds }
    }

    const configurations = await prisma.performanceConfiguration.findMany({
      where
    })

    // Mock performance optimization
    const optimizeConfiguration = async (config: any) => {
      // Simulate optimization analysis
      await new Promise(resolve => setTimeout(resolve, 500))

      const optimizations = generateOptimizations(config)
      return optimizations
    }

    // Run optimizations
    const optimizationResults = await Promise.all(
      configurations.map(async config => {
        const optimization = await optimizeConfiguration(config)

        // Apply optimizations if not dry run
        if (!dryRun && optimization.recommendedValue !== config.value) {
          await prisma.performanceConfiguration.update({
            where: { id: config.id },
            data: {
              value: optimization.recommendedValue,
              lastOptimized: new Date(),
              currentMetric: optimization.newMetric,
              lastUpdatedBy: normalizedUserId
            }
          })

          // Record optimization in system health metrics
          await prisma.systemHealthMetric.create({
            data: {
              workspaceId: config.workspaceId,
              category: 'PERFORMANCE',
              metric: `${config.category}_${config.setting}_optimization`,
              value: optimization.improvementPercent,
              unit: '%',
              status: 'HEALTHY',
              metadata: {
                configurationId: config.id,
                oldValue: config.value,
                newValue: optimization.recommendedValue,
                optimizedBy: normalizedUserId
              },
              source: 'auto_optimization',
              collectedAt: new Date()
            }
          })
        }

        return {
          configurationId: config.id,
          category: config.category,
          setting: config.setting,
          currentValue: config.value,
          recommendedValue: optimization.recommendedValue,
          expectedImprovement: optimization.improvementPercent,
          rationale: optimization.rationale,
          applied: !dryRun && optimization.recommendedValue !== config.value,
          impactScore: optimization.impactScore
        }
      })
    )

    // Generate optimization summary
    const summary = {
      totalAnalyzed: optimizationResults.length,
      optimizationsFound: optimizationResults.filter(r => r.currentValue !== r.recommendedValue).length,
      applied: dryRun ? 0 : optimizationResults.filter(r => r.applied).length,
      expectedImprovementAvg: optimizationResults.length > 0
        ? optimizationResults.reduce((sum, r) => sum + r.expectedImprovement, 0) / optimizationResults.length
        : 0,
      highImpactOptimizations: optimizationResults.filter(r => r.impactScore >= 7).length,
      optimizationTimestamp: new Date(),
      optimizedBy: {
        id: normalizedUserId,
        name: session.user.name,
        email: session.user.email
      },
      dryRun
    }

    // Generate recommendations for manual review
    const recommendations = generateOptimizationRecommendations(optimizationResults)

    return NextResponse.json({
      summary,
      results: optimizationResults,
      recommendations
    })

  } catch (error) {
    console.error('Failed to run performance optimization:', error)
    return NextResponse.json(
      { error: 'Failed to run performance optimization' },
      { status: 500 }
    )
  }
}

// Generate optimizations for a configuration
function generateOptimizations(config: any) {
  const optimizations: Record<string, any> = {
    // Database optimizations
    'DATABASE': {
      'connection_pool_size': () => {
        const current = parseInt(config.value)
        const recommended = Math.min(50, Math.max(10, current + 5))
        return {
          recommendedValue: recommended.toString(),
          improvementPercent: Math.min(20, (recommended - current) / current * 100),
          newMetric: config.currentMetric ? config.currentMetric * 0.9 : 100,
          rationale: 'Increased connection pool size can improve concurrent request handling',
          impactScore: 6
        }
      },
      'query_cache_size': () => {
        const current = parseInt(config.value)
        const recommended = Math.min(512, current * 1.2)
        return {
          recommendedValue: Math.floor(recommended).toString(),
          improvementPercent: 15,
          newMetric: config.currentMetric ? config.currentMetric * 0.85 : 90,
          rationale: 'Larger query cache reduces database load for repeated queries',
          impactScore: 7
        }
      }
    },

    // Cache optimizations
    'CACHE': {
      'redis_maxmemory': () => {
        const current = parseInt(config.value)
        const recommended = current * 1.5
        return {
          recommendedValue: Math.floor(recommended).toString(),
          improvementPercent: 25,
          newMetric: config.currentMetric ? config.currentMetric * 0.8 : 85,
          rationale: 'Increased cache memory reduces cache evictions and improves hit rate',
          impactScore: 8
        }
      },
      'cache_ttl': () => {
        const current = parseInt(config.value)
        const recommended = Math.min(7200, current * 1.2)
        return {
          recommendedValue: Math.floor(recommended).toString(),
          improvementPercent: 10,
          newMetric: config.currentMetric ? config.currentMetric * 0.95 : 95,
          rationale: 'Optimized TTL balances data freshness with cache efficiency',
          impactScore: 5
        }
      }
    },

    // API optimizations
    'API': {
      'rate_limit': () => {
        const current = parseInt(config.value)
        const recommended = Math.min(2000, current * 1.3)
        return {
          recommendedValue: Math.floor(recommended).toString(),
          improvementPercent: 20,
          newMetric: config.currentMetric ? config.currentMetric * 0.9 : 90,
          rationale: 'Increased rate limit allows for better API throughput while maintaining stability',
          impactScore: 6
        }
      },
      'timeout': () => {
        const current = parseInt(config.value)
        const recommended = Math.max(5000, current * 0.9)
        return {
          recommendedValue: Math.floor(recommended).toString(),
          improvementPercent: 12,
          newMetric: config.currentMetric ? config.currentMetric * 0.88 : 88,
          rationale: 'Optimized timeout prevents resource waste while maintaining reliability',
          impactScore: 7
        }
      }
    }
  }

  const categoryOptimizations = optimizations[config.category]
  if (categoryOptimizations && categoryOptimizations[config.setting]) {
    return categoryOptimizations[config.setting]()
  }

  // Default optimization for unknown configurations
  return {
    recommendedValue: config.value,
    improvementPercent: 0,
    newMetric: config.currentMetric || 100,
    rationale: 'No specific optimization rules available for this configuration',
    impactScore: 1
  }
}

// Generate optimization recommendations
function generateOptimizationRecommendations(results: any[]) {
  const recommendations = []

  const highImpactOptimizations = results.filter(r => r.impactScore >= 7)
  if (highImpactOptimizations.length > 0) {
    recommendations.push({
      priority: 'HIGH',
      type: 'HIGH_IMPACT_OPTIMIZATIONS',
      title: `${highImpactOptimizations.length} High-Impact Performance Optimizations Available`,
      description: 'These optimizations can significantly improve system performance',
      actions: highImpactOptimizations.map(opt => ({
        category: opt.category,
        setting: opt.setting,
        currentValue: opt.currentValue,
        recommendedValue: opt.recommendedValue,
        expectedImprovement: `${opt.expectedImprovement.toFixed(1)}%`,
        rationale: opt.rationale
      }))
    })
  }

  const databaseOptimizations = results.filter(r => r.category === 'DATABASE' && r.currentValue !== r.recommendedValue)
  if (databaseOptimizations.length > 0) {
    recommendations.push({
      priority: 'MEDIUM',
      type: 'DATABASE_PERFORMANCE',
      title: 'Database Performance Optimizations',
      description: 'Improve database performance with these configuration changes',
      actions: [
        'Review and apply connection pool size recommendations',
        'Optimize query cache settings based on workload',
        'Consider implementing database read replicas for better scalability',
        'Monitor query performance and add indexes where needed'
      ]
    })
  }

  const cacheOptimizations = results.filter(r => r.category === 'CACHE' && r.currentValue !== r.recommendedValue)
  if (cacheOptimizations.length > 0) {
    recommendations.push({
      priority: 'MEDIUM',
      type: 'CACHE_OPTIMIZATION',
      title: 'Cache Performance Improvements',
      description: 'Optimize caching strategy for better application performance',
      actions: [
        'Increase cache memory allocation for better hit rates',
        'Fine-tune cache TTL settings based on data access patterns',
        'Implement cache warming strategies for critical data',
        'Monitor cache hit rates and adjust policies accordingly'
      ]
    })
  }

  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'LOW',
      type: 'MAINTENANCE',
      title: 'Performance Configuration Optimal',
      description: 'All analyzed configurations are currently optimized',
      actions: [
        'Continue monitoring performance metrics',
        'Review configurations quarterly for new optimization opportunities',
        'Consider A/B testing for configuration changes'
      ]
    })
  }

  return recommendations
}