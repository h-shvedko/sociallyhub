import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

// CDN configuration
export interface CDNConfig {
  provider: 'cloudflare' | 'aws' | 'azure' | 'custom'
  baseUrl: string
  apiKey?: string
  secretKey?: string
  zone?: string
  bucket?: string
  region?: string
}

// Image transformation options
export interface ImageTransformOptions {
  width?: number
  height?: number
  quality?: number
  format?: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png'
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
  gravity?: 'auto' | 'center' | 'north' | 'south' | 'east' | 'west'
  blur?: number
  sharpen?: boolean
  grayscale?: boolean
  progressive?: boolean
}

// CDN optimization settings
export const CDN_SETTINGS = {
  // Image formats by browser support
  formats: {
    avif: ['image/avif'],
    webp: ['image/webp'],
    jpeg: ['image/jpeg'],
    png: ['image/png']
  },
  
  // Quality settings by use case
  quality: {
    thumbnail: 70,
    preview: 80,
    display: 85,
    hero: 90,
    print: 95
  },
  
  // Cache TTL by content type
  cacheTTL: {
    images: 31536000, // 1 year
    static: 31536000, // 1 year
    dynamic: 3600, // 1 hour
    api: 300 // 5 minutes
  },
  
  // Size breakpoints for responsive images
  breakpoints: [320, 640, 768, 1024, 1280, 1536, 1920, 2048]
}

class CDNManager {
  private config: CDNConfig

  constructor(config: CDNConfig) {
    this.config = config
  }

  // Generate CDN URL with transformations
  generateUrl(
    originalUrl: string,
    transformations: ImageTransformOptions = {}
  ): string {
    const { width, height, quality, format, fit, gravity, blur, sharpen, grayscale } = transformations
    
    const params = new URLSearchParams()
    
    // Add transformation parameters
    if (width) params.set('w', width.toString())
    if (height) params.set('h', height.toString())
    if (quality) params.set('q', quality.toString())
    if (format && format !== 'auto') params.set('f', format)
    if (fit) params.set('fit', fit)
    if (gravity) params.set('g', gravity)
    if (blur) params.set('blur', blur.toString())
    if (sharpen) params.set('sharpen', 'true')
    if (grayscale) params.set('grayscale', 'true')
    
    // Encode original URL
    params.set('url', originalUrl)
    
    return `${this.config.baseUrl}/api/images?${params.toString()}`
  }

  // Generate responsive image URLs
  generateResponsiveUrls(
    originalUrl: string,
    options: ImageTransformOptions = {}
  ): Array<{ url: string; width: number }> {
    return CDN_SETTINGS.breakpoints.map(width => ({
      url: this.generateUrl(originalUrl, { ...options, width }),
      width
    }))
  }

  // Generate srcSet for responsive images
  generateSrcSet(
    originalUrl: string,
    options: ImageTransformOptions = {}
  ): string {
    return this.generateResponsiveUrls(originalUrl, options)
      .map(({ url, width }) => `${url} ${width}w`)
      .join(', ')
  }

  // Detect optimal image format based on Accept header
  detectOptimalFormat(acceptHeader: string): string {
    if (acceptHeader.includes('image/avif')) return 'avif'
    if (acceptHeader.includes('image/webp')) return 'webp'
    return 'auto'
  }

  // Get optimal quality based on use case and device
  getOptimalQuality(
    useCase: keyof typeof CDN_SETTINGS.quality,
    isHighDPI: boolean = false
  ): number {
    const baseQuality = CDN_SETTINGS.quality[useCase]
    return isHighDPI ? Math.min(baseQuality + 10, 95) : baseQuality
  }

  // Purge cache for specific URLs
  async purgeCache(urls: string[]): Promise<boolean> {
    if (this.config.provider === 'cloudflare') {
      return this.purgeCloudflareCache(urls)
    } else if (this.config.provider === 'aws') {
      return this.purgeAWSCache(urls)
    }
    
    return false
  }

  // Purge Cloudflare cache
  private async purgeCloudflareCache(urls: string[]): Promise<boolean> {
    if (!this.config.apiKey || !this.config.zone) {
      console.error('Cloudflare API key or zone not configured')
      return false
    }

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.config.zone}/purge_cache`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            files: urls
          })
        }
      )

      const result = await response.json()
      return result.success
    } catch (error) {
      console.error('Cloudflare cache purge failed:', error)
      return false
    }
  }

  // Purge AWS CloudFront cache
  private async purgeAWSCache(urls: string[]): Promise<boolean> {
    // This would require AWS SDK integration
    console.log('AWS CloudFront cache purge not implemented')
    return false
  }

  // Preload critical images
  async preloadImages(urls: string[], priority: 'high' | 'low' = 'low'): Promise<void> {
    if (typeof window === 'undefined') return

    const promises = urls.map(url => 
      new Promise<void>((resolve, reject) => {
        const link = document.createElement('link')
        link.rel = 'preload'
        link.as = 'image'
        link.href = url
        if (priority === 'high') {
          link.setAttribute('fetchpriority', 'high')
        }
        
        link.onload = () => resolve()
        link.onerror = reject
        
        document.head.appendChild(link)
      })
    )

    try {
      await Promise.allSettled(promises)
    } catch (error) {
      console.warn('Image preloading failed:', error)
    }
  }

  // Get CDN analytics
  async getAnalytics(startDate: Date, endDate: Date): Promise<any> {
    if (this.config.provider === 'cloudflare') {
      return this.getCloudflareAnalytics(startDate, endDate)
    }
    
    return null
  }

  // Get Cloudflare analytics
  private async getCloudflareAnalytics(startDate: Date, endDate: Date): Promise<any> {
    if (!this.config.apiKey || !this.config.zone) {
      return null
    }

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.config.zone}/analytics/dashboard?since=${startDate.toISOString()}&until=${endDate.toISOString()}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      )

      return await response.json()
    } catch (error) {
      console.error('Cloudflare analytics failed:', error)
      return null
    }
  }
}

// Image processing API handler
export async function createImageProcessor() {
  return async function processImage(
    request: NextRequest
  ): Promise<NextResponse> {
    try {
      const { searchParams } = new URL(request.url)
      const url = searchParams.get('url')
      const width = searchParams.get('w')
      const height = searchParams.get('h')
      const quality = searchParams.get('q')
      const format = searchParams.get('f')
      const fit = searchParams.get('fit') as any
      const blur = searchParams.get('blur')
      const sharpen = searchParams.get('sharpen')
      const grayscale = searchParams.get('grayscale')

      if (!url) {
        return new NextResponse('URL parameter required', { status: 400 })
      }

      // Fetch the original image
      const imageResponse = await fetch(url)
      if (!imageResponse.ok) {
        return new NextResponse('Failed to fetch image', { status: 404 })
      }

      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
      
      // Process image with Sharp
      let transformer = sharp(imageBuffer)

      // Apply transformations
      if (width || height) {
        transformer = transformer.resize(
          width ? parseInt(width) : undefined,
          height ? parseInt(height) : undefined,
          {
            fit: fit || 'cover',
            withoutEnlargement: true
          }
        )
      }

      if (blur) {
        transformer = transformer.blur(parseFloat(blur))
      }

      if (sharpen === 'true') {
        transformer = transformer.sharpen()
      }

      if (grayscale === 'true') {
        transformer = transformer.grayscale()
      }

      // Determine output format
      const acceptHeader = request.headers.get('accept') || ''
      let outputFormat = format || 'auto'
      
      if (outputFormat === 'auto') {
        if (acceptHeader.includes('image/avif')) outputFormat = 'avif'
        else if (acceptHeader.includes('image/webp')) outputFormat = 'webp'
        else outputFormat = 'jpeg'
      }

      // Apply format and quality
      const outputQuality = quality ? parseInt(quality) : 85
      
      switch (outputFormat) {
        case 'avif':
          transformer = transformer.avif({ quality: outputQuality })
          break
        case 'webp':
          transformer = transformer.webp({ quality: outputQuality })
          break
        case 'png':
          transformer = transformer.png({ quality: outputQuality })
          break
        default:
          transformer = transformer.jpeg({ 
            quality: outputQuality,
            progressive: true
          })
      }

      const processedImage = await transformer.toBuffer()
      
      // Set cache headers
      const headers = new Headers()
      headers.set('Content-Type', `image/${outputFormat}`)
      headers.set('Cache-Control', `public, max-age=${CDN_SETTINGS.cacheTTL.images}, immutable`)
      headers.set('Content-Length', processedImage.length.toString())
      
      return new NextResponse(processedImage, { headers })
    } catch (error) {
      console.error('Image processing error:', error)
      return new NextResponse('Image processing failed', { status: 500 })
    }
  }
}

// Global CDN manager instance
let cdnManager: CDNManager | null = null

export function getCDNManager(): CDNManager {
  if (!cdnManager) {
    const config: CDNConfig = {
      provider: (process.env.CDN_PROVIDER as any) || 'custom',
      baseUrl: process.env.CDN_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3099',
      apiKey: process.env.CDN_API_KEY,
      secretKey: process.env.CDN_SECRET_KEY,
      zone: process.env.CDN_ZONE,
      bucket: process.env.CDN_BUCKET,
      region: process.env.CDN_REGION
    }
    
    cdnManager = new CDNManager(config)
  }
  
  return cdnManager
}

// Image optimization utilities
export const imageUtils = {
  // Generate responsive image component props
  getResponsiveProps: (
    src: string,
    alt: string,
    options: ImageTransformOptions & {
      sizes?: string
      priority?: boolean
    } = {}
  ) => {
    const cdn = getCDNManager()
    const { sizes = '100vw', priority = false, ...transformOptions } = options
    
    return {
      src: cdn.generateUrl(src, transformOptions),
      srcSet: cdn.generateSrcSet(src, transformOptions),
      sizes,
      alt,
      loading: priority ? 'eager' : 'lazy',
      priority
    }
  },

  // Optimize image URL for specific use case
  optimizeForUseCase: (
    src: string,
    useCase: keyof typeof CDN_SETTINGS.quality,
    options: ImageTransformOptions = {}
  ) => {
    const cdn = getCDNManager()
    const quality = cdn.getOptimalQuality(useCase)
    
    return cdn.generateUrl(src, { ...options, quality })
  },

  // Generate social media optimized images
  generateSocialImages: (src: string) => {
    const cdn = getCDNManager()
    
    return {
      twitter: cdn.generateUrl(src, { width: 1200, height: 675, fit: 'cover' }),
      facebook: cdn.generateUrl(src, { width: 1200, height: 630, fit: 'cover' }),
      instagram: cdn.generateUrl(src, { width: 1080, height: 1080, fit: 'cover' }),
      linkedin: cdn.generateUrl(src, { width: 1200, height: 627, fit: 'cover' })
    }
  }
}

export { CDNManager }
export default CDNManager