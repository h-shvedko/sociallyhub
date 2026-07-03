import { headers } from 'next/headers'

// Shared helper to extract request metadata (user agent, client IP, referrer)
// from the incoming request headers. Used by the support contact and chat routes.
export async function getRequestMetadata() {
  const headersList = await headers()
  const userAgent = headersList.get('user-agent') || ''
  const forwardedFor = headersList.get('x-forwarded-for')
  const realIp = headersList.get('x-real-ip')
  const ipAddress = forwardedFor?.split(',')[0] || realIp || 'unknown'
  const referrerUrl = headersList.get('referer') || ''

  return { userAgent, ipAddress, referrerUrl }
}
