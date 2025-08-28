import { NextRequest, NextResponse } from 'next/server'
import { createImageProcessor } from '@/lib/cdn/cdn-manager'

// Image processing API endpoint
export async function GET(request: NextRequest) {
  const processor = await createImageProcessor()
  return processor(request)
}

// Handle CORS for image requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
      'Access-Control-Max-Age': '86400'
    }
  })
}