import { NextRequest, NextResponse } from 'next/server'

import { getAuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isDemoMode } from '@/lib/config/demo'

// ADR-0009 Phase 0.4 — honest per-platform availability tiers.
//
// Replaces the old "always enable demo mode for all platforms" default (which
// reported every platform as `available: true` regardless of configuration).
// Each platform now resolves to exactly one tier:
//
//   'available'    — real credentials are configured for it (env vars, or an
//                    active workspace `PlatformCredentials` row) and the
//                    platform is on the real completion path. Connectable now.
//   'configurable' — a bring-your-own-credentials platform (Twitter/X, Facebook,
//                    Instagram) with no credentials yet. The user CAN connect it
//                    after adding API keys in Platform Settings.
//   'unavailable'  — LinkedIn / TikTok / YouTube: gated until their own
//                    completion phases (ADR-0009 depth-first). Never fabricated,
//                    not even in demo mode (honesty over coverage).
//   'demo'         — demo mode is explicitly on (ADR-0025) and the platform has
//                    no real credentials: a simulated connection is offered.
//
// Precedence per platform:
//   gated platform ................................ 'unavailable'
//   else has real credentials ..................... 'available'
//   else demo mode on ............................. 'demo'
//   else .......................................... 'configurable'

type PlatformTier = 'available' | 'configurable' | 'unavailable' | 'demo'

const ALL_PLATFORMS = ['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube'] as const

// Platforms gated until their own ADR-0009 completion phase. They are reported
// `unavailable` and are never demo-fabricated — the honest signal is "coming".
const GATED_PLATFORMS = new Set<string>(['linkedin', 'tiktok', 'youtube'])

/** True when this install has env-level app credentials configured for `platform`. */
function hasEnvCredentials(platform: string): boolean {
  switch (platform) {
    case 'twitter':
      return !!(process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET)
    case 'facebook':
      return !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET)
    case 'instagram':
      return !!(process.env.INSTAGRAM_CLIENT_ID && process.env.INSTAGRAM_CLIENT_SECRET)
    case 'linkedin':
      return !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET)
    case 'tiktok':
      return !!(process.env.TIKTOK_CLIENT_ID && process.env.TIKTOK_CLIENT_SECRET)
    case 'youtube':
      return !!(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET)
    default:
      return false
  }
}

function resolveTier(platform: string, hasCredentials: boolean, demo: boolean): PlatformTier {
  // Gated platforms are not on the real completion path yet — never available,
  // never demo-fabricated. Honest "coming soon" regardless of demo/credentials.
  if (GATED_PLATFORMS.has(platform)) return 'unavailable'
  if (hasCredentials) return 'available'
  if (demo) return 'demo'
  return 'configurable'
}

function tierReason(tier: PlatformTier): string | undefined {
  switch (tier) {
    case 'available':
      return undefined
    case 'demo':
      return 'Demo mode — simulated connection (no real publishing)'
    case 'configurable':
      return 'Add API credentials in Platform Settings to connect'
    case 'unavailable':
      return 'Not yet available — integration in progress'
  }
}

// GET /api/accounts/platforms - Report honest per-platform availability tiers.
//
// Optional `?workspaceId=` — when supplied by an authenticated member, a
// platform also counts as configured if the workspace has an active
// `PlatformCredentials` row (BYO app keys). Without it, only env credentials
// are considered. Auth is optional here (no sensitive data is returned); the
// workspace lookup is skipped for anonymous callers.
export async function GET(request: NextRequest) {
  try {
    const demo = isDemoMode()

    // Optional workspace-scoped credential resolution (BYO PlatformCredentials).
    let workspaceCredPlatforms = new Set<string>()
    const workspaceId = request.nextUrl.searchParams.get('workspaceId')
    if (workspaceId) {
      const user = await getAuthenticatedUser()
      if (user) {
        const membership = await prisma.userWorkspace.findFirst({
          where: { userId: user.id, workspaceId },
          select: { id: true },
        })
        if (membership) {
          const creds = await prisma.platformCredentials.findMany({
            where: { workspaceId, isActive: true },
            select: { platform: true },
          })
          workspaceCredPlatforms = new Set(creds.map((c) => c.platform.toLowerCase()))
        }
      }
    }

    const platforms = ALL_PLATFORMS.map((platform) => {
      const hasCredentials = hasEnvCredentials(platform) || workspaceCredPlatforms.has(platform)
      const tier = resolveTier(platform, hasCredentials, demo)
      const available = tier === 'available' || tier === 'demo'
      return {
        id: platform,
        name: platform.charAt(0).toUpperCase() + platform.slice(1),
        displayName: getPlatformDisplayName(platform.toUpperCase()),
        icon: getPlatformIcon(platform.toUpperCase()),
        color: getPlatformColor(platform.toUpperCase()),
        tier,
        available,
        // `configurable` platforms are not connectable now but can be set up.
        configurable: tier === 'configurable',
        reason: tierReason(tier),
      }
    })

    // Preserve the legacy two-bucket shape the accounts UI consumes
    // (`supported` = connectable now, `unavailable` = everything else) while
    // adding the richer `platforms`/`tiers` detail for honest UIs.
    const supported = platforms.filter((p) => p.available)
    const unavailable = platforms.filter((p) => !p.available)

    const tiers = {
      available: platforms.filter((p) => p.tier === 'available').map((p) => p.id),
      configurable: platforms.filter((p) => p.tier === 'configurable').map((p) => p.id),
      unavailable: platforms.filter((p) => p.tier === 'unavailable').map((p) => p.id),
      demo: platforms.filter((p) => p.tier === 'demo').map((p) => p.id),
    }

    const message = buildMessage(tiers, demo)

    return NextResponse.json({
      platforms,
      supported,
      unavailable,
      total: supported.length,
      tiers,
      demoMode: demo,
      message,
    })
  } catch (error) {
    console.error('Error getting platform info:', error)
    return NextResponse.json(
      { error: 'Failed to get platform information' },
      { status: 500 }
    )
  }
}

function buildMessage(
  tiers: { available: string[]; configurable: string[]; unavailable: string[]; demo: string[] },
  demo: boolean
): string {
  const parts: string[] = []
  const connectable = tiers.available.length + tiers.demo.length
  parts.push(`${connectable} platform${connectable === 1 ? '' : 's'} connectable`)
  if (demo && tiers.demo.length > 0) {
    parts.push(`${tiers.demo.length} in demo mode`)
  }
  if (tiers.configurable.length > 0) {
    parts.push(`${tiers.configurable.length} configurable (add credentials)`)
  }
  if (tiers.unavailable.length > 0) {
    parts.push(`${tiers.unavailable.length} not yet available`)
  }
  return `${parts.join(', ')}.`
}

function getPlatformDisplayName(platform: string): string {
  const displayNames: Record<string, string> = {
    'TWITTER': 'Twitter/X',
    'FACEBOOK': 'Facebook',
    'INSTAGRAM': 'Instagram',
    'LINKEDIN': 'LinkedIn',
    'TIKTOK': 'TikTok',
    'YOUTUBE': 'YouTube'
  }
  return displayNames[platform.toUpperCase()] || platform
}

function getPlatformIcon(platform: string): string {
  const icons: Record<string, string> = {
    'TWITTER': '𝕏',
    'FACEBOOK': '󠁦',
    'INSTAGRAM': '📷',
    'LINKEDIN': '💼',
    'TIKTOK': '🎵',
    'YOUTUBE': '📺'
  }
  return icons[platform.toUpperCase()] || '📱'
}

function getPlatformColor(platform: string): string {
  const colors: Record<string, string> = {
    'TWITTER': 'bg-black text-white',
    'FACEBOOK': 'bg-blue-600 text-white',
    'INSTAGRAM': 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
    'LINKEDIN': 'bg-blue-700 text-white',
    'TIKTOK': 'bg-black text-white',
    'YOUTUBE': 'bg-red-600 text-white'
  }
  return colors[platform.toUpperCase()] || 'bg-gray-600 text-white'
}
