// GDPR / account profile endpoint (ADR-0017 Track C, Phase 1 item 6).
//
// GET  → the authenticated user's own editable profile fields.
// PUT  → update ONLY name/image (the only User columns that back the
//        profile form). Any other keys in the body are ignored on purpose:
//        phone/company/location/bio have no columns and must never pretend
//        to persist (ADR-0017 honesty).

import { NextRequest, NextResponse } from 'next/server'

import { requireSession } from '@/lib/auth'
import { jsonError, handleApiError } from '@/lib/api/respond'
import { prisma } from '@/lib/prisma'

const MAX_NAME_LENGTH = 200
const MAX_IMAGE_LENGTH = 2048

export async function GET() {
  try {
    const user = await requireSession()

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, image: true, email: true, createdAt: true },
    })
    if (!dbUser) {
      return jsonError(404, 'User not found')
    }

    return NextResponse.json(dbUser)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireSession()

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return jsonError(400, 'Invalid request body')
    }

    // Only these two fields are accepted; everything else is ignored.
    const data: { name?: string; image?: string | null } = {}

    if ('name' in body) {
      const { name } = body as { name?: unknown }
      if (typeof name !== 'string' || name.trim().length === 0) {
        return jsonError(400, 'Name must be a non-empty string')
      }
      if (name.length > MAX_NAME_LENGTH) {
        return jsonError(400, `Name must be at most ${MAX_NAME_LENGTH} characters`)
      }
      data.name = name.trim()
    }

    if ('image' in body) {
      const { image } = body as { image?: unknown }
      if (image === null || image === '') {
        data.image = null
      } else if (typeof image === 'string') {
        if (image.length > MAX_IMAGE_LENGTH) {
          return jsonError(400, 'Image URL is too long')
        }
        data.image = image
      } else {
        return jsonError(400, 'Image must be a string URL or null')
      }
    }

    if (Object.keys(data).length === 0) {
      return jsonError(400, 'No updatable fields provided (name, image)')
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data,
      select: { name: true, image: true, email: true, createdAt: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
