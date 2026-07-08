import {
  type PrismaClient,
  SystemConfigCategory,
  ConfigDataType,
  SecurityCategory,
  SecuritySeverity,
  EmailTemplateCategory,
  FeatureFlagCategory,
} from '@prisma/client'

/**
 * ADR-0025 D3 — MINIMAL tier: prod-safe, idempotent defaults seeder.
 *
 * This is the new home for the inline ADR-0016 "default settings" block that
 * used to live in `prisma/seed.ts` (three deferral feature flags + a default
 * BackupConfiguration). It runs on EVERY boot (dev and prod) and must therefore
 * be:
 *   - idempotent      → every row is find-or-create by its natural key, never
 *                       deleteMany. Re-running seeds nothing new.
 *   - prod-safe       → seeds only global (workspaceId: null) rows plus, when a
 *                       workspace already exists, a couple of system email
 *                       templates. On a truly fresh production DB (no workspace)
 *                       the template group is skipped honestly, not forced.
 *   - best-effort     → each group is wrapped so a partial failure logs and the
 *                       remaining groups still run (a broken template row must
 *                       not block feature-flag seeding).
 *
 * Attribution author (the required `lastUpdatedBy` / `createdBy` FKs):
 * `SystemConfiguration.lastUpdatedBy`, `FeatureFlag.createdBy/lastUpdatedBy`,
 * `SecurityConfiguration.lastUpdatedBy` and `EmailTemplate.createdBy/lastUpdatedBy`
 * are all NON-NULL foreign keys to `users.id` with `ON DELETE RESTRICT` (verified
 * in migration 20260702195923). A literal `'system'` string would violate that FK,
 * so we ensure a dedicated, login-disabled `System` user with the fixed id
 * `'system'` exists first and attribute every auto-seeded row to it. That user
 * has `password: null`, so the credentials provider rejects any login attempt
 * (`authorize()` returns null when `!user.password`) — it is an attribution
 * anchor only, never a usable account.
 *
 * FeatureFlag idempotency note (ADR-0025): `@@unique([workspaceId, key])` is on a
 * NULLable `workspaceId`, and Postgres does not treat two NULLs as equal, so a
 * compound-key `upsert` is NOT reliably idempotent for GLOBAL rows. We use a
 * manual findFirst(where key + workspaceId null) → create instead. The same
 * applies to the global BackupConfiguration (`@@unique([workspaceId, name])`).
 *
 * The three deferral flags are created DISABLED (isActive: false) per
 * ADR-0013 (community), ADR-0014 (documentation-management) and ADR-0015
 * (discord). They are INERT: the live deferral gates stay on the static
 * FEATURE_COMMUNITY / FEATURE_DOCS_MANAGEMENT / FEATURE_DISCORD env vars — these
 * rows exist only as a future migration target for a DB-backed flag evaluator.
 */

const SYSTEM_USER_ID = 'system'

/**
 * Ensure the login-disabled `System` attribution user exists. Idempotent
 * (upsert by the fixed id). Returns the id to attribute rows to.
 */
async function ensureSystemUser(prisma: PrismaClient): Promise<string> {
  await prisma.user.upsert({
    where: { id: SYSTEM_USER_ID },
    // Never overwrite an operator-managed row; only guarantee existence.
    update: {},
    create: {
      id: SYSTEM_USER_ID,
      email: 'system@sociallyhub.local',
      name: 'System',
      // No password → the credentials provider's authorize() returns null, so
      // this account can never sign in. It is an attribution anchor only.
      password: null,
      emailVerified: new Date(),
      isPlatformAdmin: false,
    },
  })
  return SYSTEM_USER_ID
}

export async function seedSettingsDefaults(
  prisma: PrismaClient,
): Promise<{ configs: number; flags: number; templates: number }> {
  let configs = 0
  let flags = 0
  let templates = 0

  // Attribution author is a hard prerequisite: without it every group below
  // would FK-fail. If this throws, there is nothing to attribute, so surface it.
  const systemUserId = await ensureSystemUser(prisma)

  // ---- 1) Global SystemConfiguration defaults (workspaceId: null) ----------
  // Honest, generic platform defaults. The admin-settings APIs list by
  // (category, key) — they do not require any specific key, so these are safe,
  // real defaults a fresh install benefits from. find-or-create by natural key.
  try {
    const systemConfigs: Array<{
      category: SystemConfigCategory
      key: string
      value: string
      dataType: ConfigDataType
      description: string
    }> = [
      {
        category: SystemConfigCategory.GENERAL,
        key: 'platform_name',
        value: 'SociallyHub',
        dataType: ConfigDataType.STRING,
        description: 'Display name of the platform.',
      },
      {
        category: SystemConfigCategory.GENERAL,
        key: 'maintenance_mode',
        value: 'false',
        dataType: ConfigDataType.BOOLEAN,
        description: 'When true, the platform is placed in maintenance mode.',
      },
      {
        category: SystemConfigCategory.GENERAL,
        key: 'registration_open',
        value: 'true',
        dataType: ConfigDataType.BOOLEAN,
        description: 'When true, new users may self-register.',
      },
      {
        category: SystemConfigCategory.GENERAL,
        key: 'support_email',
        value: 'support@sociallyhub.com',
        dataType: ConfigDataType.EMAIL,
        description: 'Address shown to users for support contact.',
      },
      {
        category: SystemConfigCategory.STORAGE,
        key: 'max_upload_mb',
        value: '25',
        dataType: ConfigDataType.INTEGER,
        description: 'Maximum single-file upload size in megabytes.',
      },
    ]

    for (const cfg of systemConfigs) {
      const existing = await prisma.systemConfiguration.findFirst({
        where: { workspaceId: null, category: cfg.category, key: cfg.key },
      })
      if (!existing) {
        await prisma.systemConfiguration.create({
          data: {
            workspaceId: null,
            category: cfg.category,
            key: cfg.key,
            value: cfg.value,
            dataType: cfg.dataType,
            description: cfg.description,
            defaultValue: cfg.value,
            lastUpdatedBy: systemUserId,
          },
        })
        configs++
      }
    }
  } catch (error) {
    console.error('   ⚠️  settings-defaults: SystemConfiguration group failed (continuing):', error)
  }

  // ---- 2) Baseline SecurityConfiguration (workspaceId: null) ---------------
  try {
    const securityConfigs: Array<{
      category: SecurityCategory
      setting: string
      value: string
      severity: SecuritySeverity
      description: string
      recommendedValue: string
    }> = [
      {
        category: SecurityCategory.PASSWORD_POLICY,
        setting: 'min_password_length',
        value: '8',
        severity: SecuritySeverity.HIGH,
        description: 'Minimum number of characters required for user passwords.',
        recommendedValue: '12',
      },
      {
        category: SecurityCategory.AUTHENTICATION,
        setting: 'require_email_verification',
        value: 'true',
        severity: SecuritySeverity.MEDIUM,
        description: 'Require users to verify their email before full access.',
        recommendedValue: 'true',
      },
    ]

    for (const sec of securityConfigs) {
      const existing = await prisma.securityConfiguration.findFirst({
        where: { workspaceId: null, category: sec.category, setting: sec.setting },
      })
      if (!existing) {
        await prisma.securityConfiguration.create({
          data: {
            workspaceId: null,
            category: sec.category,
            setting: sec.setting,
            value: sec.value,
            isEnabled: true,
            severity: sec.severity,
            description: sec.description,
            recommendedValue: sec.recommendedValue,
            lastUpdatedBy: systemUserId,
          },
        })
        configs++
      }
    }
  } catch (error) {
    console.error('   ⚠️  settings-defaults: SecurityConfiguration group failed (continuing):', error)
  }

  // ---- 3) DISABLED deferral FeatureFlags (global, workspaceId: null) -------
  // Keys pinned by ADR-0025: 'community' / 'documentation-management' / 'discord'.
  // (These replace the old inline placeholder keys community-subsystem /
  // discord-integration.) Created DISABLED per ADR-0013/0014/0015. INERT: the
  // live deferral gates remain the static FEATURE_* env vars — these rows are a
  // future migration target for a DB-backed flag evaluator only.
  try {
    const deferralFlags: Array<{ key: string; name: string; description: string }> = [
      {
        key: 'community',
        name: 'Community Subsystem',
        description:
          'DISABLED deferral flag (ADR-0013). The Community subsystem stays gated by the static FEATURE_COMMUNITY env var; this row is inert and exists only as a future DB-backed-flag migration target.',
      },
      {
        key: 'documentation-management',
        name: 'Documentation Management',
        description:
          'DISABLED deferral flag (ADR-0014). Documentation Management stays gated by the static FEATURE_DOCS_MANAGEMENT env var; this row is inert and exists only as a future DB-backed-flag migration target.',
      },
      {
        key: 'discord',
        name: 'Discord Integration',
        description:
          'DISABLED deferral flag (ADR-0015). Discord integration stays gated by the static FEATURE_DISCORD env var; this row is inert and exists only as a future DB-backed-flag migration target.',
      },
    ]

    for (const flag of deferralFlags) {
      const existing = await prisma.featureFlag.findFirst({
        where: { workspaceId: null, key: flag.key },
      })
      if (!existing) {
        await prisma.featureFlag.create({
          data: {
            workspaceId: null,
            key: flag.key,
            name: flag.name,
            description: flag.description,
            category: FeatureFlagCategory.FEATURE,
            isActive: false,
            rolloutPercent: 0,
            tags: ['deferral', 'adr-0025'],
            createdBy: systemUserId,
            lastUpdatedBy: systemUserId,
          },
        })
        flags++
      }
    }
  } catch (error) {
    console.error('   ⚠️  settings-defaults: FeatureFlag group failed (continuing):', error)
  }

  // ---- 4) Default GLOBAL BackupConfiguration (workspaceId: null) -----------
  // Mirrors the old inline ADR-0016 row for parity. Created INACTIVE so seeding
  // never silently starts writing dumps; an admin enables it. Counted under
  // `configs`. find-or-create by @@unique([workspaceId, name]) (nullable-ws).
  try {
    const existingBackup = await prisma.backupConfiguration.findFirst({
      where: { workspaceId: null, name: 'Default database backup' },
    })
    if (!existingBackup) {
      await prisma.backupConfiguration.create({
        data: {
          workspaceId: null,
          name: 'Default database backup',
          backupType: 'DATABASE_ONLY',
          schedule: '0 2 * * *', // nightly at 02:00 once activated
          isActive: false,
          retention: 30,
          storageLocation: 'LOCAL',
          storageConfig: {},
          createdBy: systemUserId,
          lastUpdatedBy: systemUserId,
        },
      })
      configs++
    }
  } catch (error) {
    console.error('   ⚠️  settings-defaults: BackupConfiguration group failed (continuing):', error)
  }

  // ---- 5) System EmailTemplate rows ----------------------------------------
  // EmailTemplate.workspaceId is REQUIRED (a real workspace FK) — there is no
  // global email template. On a fresh production DB with no workspace yet, we
  // skip this group honestly (logged) rather than fabricate a placeholder
  // workspace. When a workspace exists (dev/demo), seed two system templates
  // into it, find-or-create by @@unique([workspaceId, slug]).
  try {
    const targetWorkspace =
      (await prisma.workspace.findUnique({ where: { id: 'demo-workspace' }, select: { id: true } })) ??
      (await prisma.workspace.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } }))

    if (!targetWorkspace) {
      console.log('   ⏭️  settings-defaults: no workspace exists yet — skipping system EmailTemplate rows (prod-safe)')
    } else {
      const emailTemplates: Array<{
        slug: string
        name: string
        category: EmailTemplateCategory
        subject: string
        htmlContent: string
        textContent: string
        variables: string[]
      }> = [
        {
          slug: 'system-welcome',
          name: 'Welcome Email',
          category: EmailTemplateCategory.WELCOME,
          subject: 'Welcome to {{platformName}}',
          htmlContent:
            '<p>Hi {{userName}},</p><p>Welcome to {{platformName}}! Your account is ready. Sign in to get started.</p>',
          textContent: 'Hi {{userName}}, welcome to {{platformName}}! Your account is ready.',
          variables: ['userName', 'platformName'],
        },
        {
          slug: 'system-password-reset',
          name: 'Password Reset',
          category: EmailTemplateCategory.AUTHENTICATION,
          subject: 'Reset your {{platformName}} password',
          htmlContent:
            '<p>Hi {{userName}},</p><p>Use the link below to reset your password. It expires in 24 hours.</p><p><a href="{{resetUrl}}">Reset password</a></p>',
          textContent: 'Hi {{userName}}, reset your password: {{resetUrl}} (expires in 24 hours).',
          variables: ['userName', 'platformName', 'resetUrl'],
        },
      ]

      for (const tpl of emailTemplates) {
        const existing = await prisma.emailTemplate.findFirst({
          where: { workspaceId: targetWorkspace.id, slug: tpl.slug },
        })
        if (!existing) {
          await prisma.emailTemplate.create({
            data: {
              workspaceId: targetWorkspace.id,
              name: tpl.name,
              slug: tpl.slug,
              category: tpl.category,
              subject: tpl.subject,
              htmlContent: tpl.htmlContent,
              textContent: tpl.textContent,
              variables: tpl.variables,
              isActive: true,
              isSystem: true,
              createdBy: systemUserId,
              lastUpdatedBy: systemUserId,
            },
          })
          templates++
        }
      }
    }
  } catch (error) {
    console.error('   ⚠️  settings-defaults: EmailTemplate group failed (continuing):', error)
  }

  console.log(
    `   ⚙️  Settings defaults seeded: ${configs} config rows (system + security + backup), ` +
      `${flags} deferral flag(s), ${templates} system email template(s)`,
  )

  return { configs, flags, templates }
}
