/**
 * OFFLINE i18n draft generator (ADR-0017, Decision D3).
 *
 * Machine-translates the reviewed English dictionary
 * (src/lib/i18n/dictionaries/en.json) into DRAFT dictionaries for the other
 * locales, writing src/lib/i18n/dictionaries/<locale>.json.
 *
 * IMPORTANT — these are UNREVIEWED MACHINE-TRANSLATION DRAFTS:
 *   - They MUST be reviewed and corrected by a human before being committed.
 *   - A locale only ships once its dictionary is reviewed AND the locale is
 *     added to `enabledLocales` in src/lib/i18n/config.ts.
 *   - Nothing in the request/render path calls the translation service anymore;
 *     this script is the only place it runs, and only when you run it by hand.
 *
 * Requirements:
 *   - OPENAI_API_KEY must be set (otherwise the service returns the English
 *     text unchanged and no useful draft is produced).
 *
 * Usage:
 *   npm run i18n:generate            # generate drafts for all non-en locales
 *   npm run i18n:generate -- fr de   # generate drafts for specific locales
 */
import { promises as fs } from 'fs'
import path from 'path'
import { locales, localeNames, defaultLocale, isValidLocale, type Locale } from '../src/lib/i18n/config'
import { translationService } from '../src/lib/i18n/translation-service'

const DICT_DIR = path.join(__dirname, '..', 'src', 'lib', 'i18n', 'dictionaries')

async function main() {
  const requested = process.argv.slice(2).filter(Boolean)

  // Determine target locales (everything except the base English dictionary).
  let targets: Locale[]
  if (requested.length > 0) {
    const invalid = requested.filter((l) => !isValidLocale(l) || l === defaultLocale)
    if (invalid.length > 0) {
      console.error(`Ignoring unknown/base locales: ${invalid.join(', ')}`)
    }
    targets = requested.filter((l): l is Locale => isValidLocale(l) && l !== defaultLocale)
  } else {
    targets = locales.filter((l) => l !== defaultLocale)
  }

  if (targets.length === 0) {
    console.error('No target locales to generate. Nothing to do.')
    process.exit(1)
  }

  if (!process.env.OPENAI_API_KEY) {
    console.warn(
      '⚠️  OPENAI_API_KEY is not set — the translation service will return English unchanged.\n' +
        '   Set OPENAI_API_KEY to produce real draft translations.'
    )
  }

  const enRaw = await fs.readFile(path.join(DICT_DIR, `${defaultLocale}.json`), 'utf-8')
  const enDict = JSON.parse(enRaw)

  console.info(`Generating DRAFT dictionaries for: ${targets.map((t) => localeNames[t]).join(', ')}`)
  console.info('These are UNREVIEWED machine-translation drafts — a human MUST review them before commit/enable.\n')

  for (const locale of targets) {
    console.info(`→ ${localeNames[locale]} (${locale})…`)
    const translated = await translationService.translateDictionary(enDict, locale)
    const outPath = path.join(DICT_DIR, `${locale}.json`)
    await fs.writeFile(outPath, JSON.stringify(translated, null, 2) + '\n', 'utf-8')
    console.info(`  wrote DRAFT ${outPath}`)
  }

  console.info(
    '\nDone. Reminder: these drafts are NOT localization until a human reviews them and the\n' +
      "locale is added to `enabledLocales` in src/lib/i18n/config.ts. Do not commit unreviewed drafts."
  )
}

main().catch((err) => {
  console.error('i18n:generate failed:', err)
  process.exit(1)
})
