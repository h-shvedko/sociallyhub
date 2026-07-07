/**
 * E2E fixture seeder (ADR-0021 Track E).
 *
 * IDEMPOTENT and SMALL: every row is upserted under a stable `e2e-` prefixed id
 * (or a stable unique key), so it can run any number of times against a dev or
 * CI database. It NEVER deletes anything and never touches non-e2e data.
 *
 * Run standalone:      npx tsx prisma/seed-e2e.ts
 * Or programmatically: import { seedE2E } from './seed-e2e'
 *
 * Fixture ids/credentials live in e2e/fixtures.ts — the same constants the
 * Playwright specs assert against.
 */
import type { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import {
  E2E_USER,
  E2E_WORKSPACE,
  E2E_SOCIAL_ACCOUNT,
  E2E_POST_DRAFT,
  E2E_POST_SCHEDULED,
  E2E_CLIENT,
  E2E_REPORT_TEMPLATE,
  E2E_INBOX_ITEM_1,
  E2E_INBOX_ITEM_2,
} from '../e2e/fixtures'

/**
 * SocialAccount.accessToken is encrypted at rest when ENCRYPTION_KEY is set
 * (ADR-0006). Encrypt when we can; otherwise store a plainly-labelled dummy.
 * The account carries metadata.demoAccount=true and a fake accountId, so no
 * real provider call can ever succeed against it either way.
 * (Dynamic import so a missing/misconfigured key never crashes at module scope.)
 */
async function fixtureAccessToken(): Promise<string> {
  const plain = 'e2e-demo-token-not-a-real-credential'
  try {
    const enc = await import('../src/lib/encryption')
    if (enc.isEncryptionConfigured()) {
      return enc.encryptToken(plain)
    }
  } catch {
    // encryption module unavailable/misconfigured — fall through to plain
  }
  return plain
}

export async function seedE2E(prisma: PrismaClient) {
  console.log('🌱 Seeding e2e fixtures (idempotent, e2e-* ids only)...')

  // --- User (upsert by unique email; keep whatever id exists, verified now) ---
  const passwordHash = await bcrypt.hash(E2E_USER.password, 12)
  const user = await prisma.user.upsert({
    where: { email: E2E_USER.email },
    update: {
      name: E2E_USER.name,
      password: passwordHash,
      emailVerified: new Date(),
    },
    create: {
      id: E2E_USER.id,
      email: E2E_USER.email,
      name: E2E_USER.name,
      password: passwordHash,
      emailVerified: new Date(),
    },
  })

  // --- Workspace + OWNER membership ---
  const workspace = await prisma.workspace.upsert({
    where: { id: E2E_WORKSPACE.id },
    update: { name: E2E_WORKSPACE.name },
    create: { id: E2E_WORKSPACE.id, name: E2E_WORKSPACE.name },
  })

  await prisma.userWorkspace.upsert({
    where: {
      userId_workspaceId: { userId: user.id, workspaceId: workspace.id },
    },
    update: { role: 'OWNER' },
    create: { userId: user.id, workspaceId: workspace.id, role: 'OWNER' },
  })

  // --- Subscription: BUSINESS / ACTIVE (unique per workspace) ---
  const periodStart = new Date()
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  await prisma.subscription.upsert({
    where: { workspaceId: workspace.id },
    update: {
      planTier: 'BUSINESS',
      status: 'ACTIVE',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    },
    create: {
      workspaceId: workspace.id,
      planTier: 'BUSINESS',
      status: 'ACTIVE',
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    },
  })

  // --- SocialAccount fixture (demo-flagged; no real polling/publishing) ---
  const accessToken = await fixtureAccessToken()
  await prisma.socialAccount.upsert({
    where: { id: E2E_SOCIAL_ACCOUNT.id },
    update: {
      status: 'ACTIVE',
      accessToken,
      metadata: { demoAccount: true },
    },
    create: {
      id: E2E_SOCIAL_ACCOUNT.id,
      workspaceId: workspace.id,
      provider: 'TWITTER',
      accountType: 'profile',
      handle: E2E_SOCIAL_ACCOUNT.handle,
      displayName: E2E_SOCIAL_ACCOUNT.displayName,
      accountId: E2E_SOCIAL_ACCOUNT.accountId,
      accessToken,
      scopes: [],
      status: 'ACTIVE',
      metadata: { demoAccount: true },
    },
  })

  // --- Posts: one DRAFT, one SCHEDULED (seeded directly — no jobs enqueued) ---
  await prisma.post.upsert({
    where: { id: E2E_POST_DRAFT.id },
    update: {
      title: E2E_POST_DRAFT.title,
      baseContent: E2E_POST_DRAFT.baseContent,
      status: 'DRAFT',
    },
    create: {
      id: E2E_POST_DRAFT.id,
      workspaceId: workspace.id,
      ownerId: user.id,
      title: E2E_POST_DRAFT.title,
      baseContent: E2E_POST_DRAFT.baseContent,
      status: 'DRAFT',
      tags: ['e2e'],
    },
  })

  const scheduledAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await prisma.post.upsert({
    where: { id: E2E_POST_SCHEDULED.id },
    update: {
      title: E2E_POST_SCHEDULED.title,
      baseContent: E2E_POST_SCHEDULED.baseContent,
      status: 'SCHEDULED',
      scheduledAt,
    },
    create: {
      id: E2E_POST_SCHEDULED.id,
      workspaceId: workspace.id,
      ownerId: user.id,
      title: E2E_POST_SCHEDULED.title,
      baseContent: E2E_POST_SCHEDULED.baseContent,
      status: 'SCHEDULED',
      scheduledAt,
      tags: ['e2e'],
    },
  })

  // --- Client ---
  await prisma.client.upsert({
    where: { id: E2E_CLIENT.id },
    update: { name: E2E_CLIENT.name, email: E2E_CLIENT.email, status: 'ACTIVE' },
    create: {
      id: E2E_CLIENT.id,
      workspaceId: workspace.id,
      name: E2E_CLIENT.name,
      email: E2E_CLIENT.email,
      status: 'ACTIVE',
      labels: ['e2e'],
    },
  })

  // --- Client report template (sections is a required Json field) ---
  await prisma.clientReportTemplate.upsert({
    where: { id: E2E_REPORT_TEMPLATE.id },
    update: { name: E2E_REPORT_TEMPLATE.name, isActive: true },
    create: {
      id: E2E_REPORT_TEMPLATE.id,
      workspaceId: workspace.id,
      name: E2E_REPORT_TEMPLATE.name,
      description: 'Deterministic e2e fixture template',
      type: E2E_REPORT_TEMPLATE.type,
      format: ['PDF'],
      metrics: ['engagement', 'reach'],
      sections: [{ id: 'summary', title: 'Executive Summary' }],
      isActive: true,
    },
  })

  // --- Inbox items (attached to the demo-flagged social account) ---
  await prisma.inboxItem.upsert({
    where: { id: E2E_INBOX_ITEM_1.id },
    update: { content: E2E_INBOX_ITEM_1.content, status: 'OPEN' },
    create: {
      id: E2E_INBOX_ITEM_1.id,
      workspaceId: workspace.id,
      socialAccountId: E2E_SOCIAL_ACCOUNT.id,
      type: 'COMMENT',
      providerItemId: E2E_INBOX_ITEM_1.providerItemId,
      content: E2E_INBOX_ITEM_1.content,
      authorName: E2E_INBOX_ITEM_1.authorName,
      authorHandle: 'e2e_author_one',
      sentiment: 'positive',
      status: 'OPEN',
      tags: ['e2e'],
    },
  })

  await prisma.inboxItem.upsert({
    where: { id: E2E_INBOX_ITEM_2.id },
    update: { content: E2E_INBOX_ITEM_2.content, status: 'OPEN' },
    create: {
      id: E2E_INBOX_ITEM_2.id,
      workspaceId: workspace.id,
      socialAccountId: E2E_SOCIAL_ACCOUNT.id,
      type: 'MENTION',
      providerItemId: E2E_INBOX_ITEM_2.providerItemId,
      content: E2E_INBOX_ITEM_2.content,
      authorName: E2E_INBOX_ITEM_2.authorName,
      authorHandle: 'e2e_author_two',
      sentiment: 'neutral',
      status: 'OPEN',
      tags: ['e2e'],
    },
  })

  console.log('✅ e2e fixtures seeded:')
  console.log(`   user       ${user.id} (${E2E_USER.email})`)
  console.log(`   workspace  ${workspace.id} (BUSINESS/ACTIVE subscription)`)
  console.log(`   posts      ${E2E_POST_DRAFT.id} (DRAFT), ${E2E_POST_SCHEDULED.id} (SCHEDULED)`)
  console.log(`   client     ${E2E_CLIENT.id} + template ${E2E_REPORT_TEMPLATE.id}`)
  console.log(`   inbox      ${E2E_INBOX_ITEM_1.id}, ${E2E_INBOX_ITEM_2.id} (account ${E2E_SOCIAL_ACCOUNT.id})`)
}

// CLI wrapper: `npx tsx prisma/seed-e2e.ts` (Track C wires the package.json script)
if (require.main === module) {
  // tsx does NOT auto-load .env.local (the first verify pass failed with
  // "Environment variable not found: DATABASE_URL"). Load it minimally when
  // DATABASE_URL is absent so the documented bare command Just Works.
  if (!process.env.DATABASE_URL) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs') as typeof import('fs')
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path') as typeof import('path')
    const envPath = path.join(__dirname, '..', '.env.local')
    if (fs.existsSync(envPath)) {
      for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
        const m = line.match(/^([A-Z0-9_]+)=["']?([^"'\n]*)["']?\s*$/)
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
      }
    }
  }
  // Client constructed only when actually run — never at import time.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaClient } = require('@prisma/client') as typeof import('@prisma/client')
  const prisma = new PrismaClient()
  seedE2E(prisma)
    .catch((e) => {
      console.error('❌ e2e seeding failed:', e)
      process.exitCode = 1
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
