// DB-backed SocialAccount loader with token decryption (ADR-0009 Phase 0).
//
// The single, reusable seam for turning a stored `SocialAccount` row (whose
// `accessToken`/`refreshToken` are encrypted at rest per ADR-0006, `enc:v1`
// format) into an account whose tokens are decrypted and ready to hand to a
// provider. Used by BOTH the BullMQ workers (which run in a separate process
// and can never rely on any in-memory account cache) and API routes.
//
// It NEVER fabricates data: a missing row returns `null`; a token that fails to
// decrypt (tampered ciphertext / wrong key) throws — the caller must surface an
// honest failure, never a fake success.

import { prisma } from '@/lib/prisma'
import { decryptToken } from '@/lib/encryption'
import type { SocialAccount as PrismaSocialAccount } from '@prisma/client'

/**
 * A `SocialAccount` row whose token columns have been decrypted. Same shape as
 * the Prisma model, but `accessToken`/`refreshToken` hold plaintext secrets —
 * never log this object.
 */
export type DecryptedSocialAccount = Omit<
  PrismaSocialAccount,
  'accessToken' | 'refreshToken'
> & {
  accessToken: string
  refreshToken: string | null
}

/**
 * Decrypt the token columns of an already-loaded `SocialAccount` row.
 *
 * Throws if a stored `enc:v1` token fails authentication (tamper/wrong key).
 * Legacy plaintext tokens are returned as-is by `decryptToken` during the
 * bounded ADR-0006 Phase 3 transition (with a warning from that module).
 */
export function decryptAccountTokens(
  account: PrismaSocialAccount
): DecryptedSocialAccount {
  const accessToken = (decryptToken(account.accessToken) as string) ?? ''
  const rt = decryptToken(account.refreshToken)
  return { ...account, accessToken, refreshToken: rt ?? null }
}

/**
 * Load a `SocialAccount` by id and return it with `accessToken`/`refreshToken`
 * decrypted. Returns `null` when no such account exists. Throws only when a
 * stored ciphertext fails to decrypt (a real config/tamper problem the caller
 * must handle honestly, not paper over).
 */
export async function getDecryptedAccount(
  accountId: string
): Promise<DecryptedSocialAccount | null> {
  const account = await prisma.socialAccount.findUnique({
    where: { id: accountId },
  })
  if (!account) return null
  return decryptAccountTokens(account)
}
