import { ImageProps } from 'next/image'

// Image optimization utilities
export interface OptimizedImageProps extends Omit<ImageProps, 'src'> {
  src: string
  alt: string
  loading?: 'lazy' | 'eager'
  priority?: boolean
  quality?: number
}

// Responsive image sizes configuration
export const responsiveImageSizes = {
  xs: '(max-width: 475px) 100vw',
  sm: '(max-width: 640px) 100vw',
  md: '(max-width: 768px) 100vw', 
  lg: '(max-width: 1024px) 100vw',
  xl: '(max-width: 1280px) 100vw',
  '2xl': '100vw'
}

// Image size configurations for different use cases
export const imageSizeConfigs = {
  avatar: {
    small: { width: 32, height: 32 },
    medium: { width: 48, height: 48 },
    large: { width: 64, height: 64 },
    xl: { width: 96, height: 96 }
  },
  thumbnail: {
    small: { width: 150, height: 150 },
    medium: { width: 200, height: 200 },
    large: { width: 300, height: 300 }
  },
  card: {
    small: { width: 320, height: 180 },
    medium: { width: 480, height: 270 },
    large: { width: 640, height: 360 }
  },
  hero: {
    mobile: { width: 768, height: 432 },
    tablet: { width: 1024, height: 576 },
    desktop: { width: 1920, height: 1080 }
  },
  post: {
    instagram: { width: 1080, height: 1080 },
    facebook: { width: 1200, height: 630 },
    twitter: { width: 1200, height: 675 },
    linkedin: { width: 1200, height: 627 }
  }
}

// Image quality settings by use case
export const imageQuality = {
  thumbnail: 75,
  card: 85,
  hero: 90,
  avatar: 80,
  post: 85,
  highQuality: 95
}

// Generate responsive sizes string
export function generateSizes(breakpoints: (keyof typeof responsiveImageSizes)[]): string {
  return breakpoints
    .map(bp => responsiveImageSizes[bp])
    .join(', ')
}

// Get optimized image props
export function getOptimizedImageProps(
  src: string,
  alt: string,
  type: keyof typeof imageSizeConfigs,
  size: string,
  options?: Partial<OptimizedImageProps>
): OptimizedImageProps {
  const config = imageSizeConfigs[type]
  const sizeConfig = config[size as keyof typeof config]
  
  if (!sizeConfig) {
    throw new Error(`Invalid size '${size}' for image type '${type}'`)
  }
  
  return {
    src,
    alt,
    width: sizeConfig.width,
    height: sizeConfig.height,
    quality: imageQuality[type] || imageQuality.card,
    loading: options?.priority ? 'eager' : 'lazy',
    priority: options?.priority || false,
    placeholder: 'blur',
    blurDataURL: generateBlurDataURL(sizeConfig.width, sizeConfig.height),
    ...options
  }
}

// Generate blur placeholder
export function generateBlurDataURL(width: number, height: number): string {
  const canvas = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#f3f4f6;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#e5e7eb;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad)" />
    </svg>
  `
  
  return `data:image/svg+xml;base64,${Buffer.from(canvas).toString('base64')}`
}

// Image format detection and conversion
export function getOptimalFormat(originalFormat: string, supportsWebP: boolean, supportsAVIF: boolean): string {
  if (supportsAVIF) return 'avif'
  if (supportsWebP) return 'webp'
  return originalFormat
}

// CDN URL generation
export function generateCDNUrl(
  src: string,
  width: number,
  height: number,
  quality: number = 85,
  format: string = 'auto'
): string {
  const cdnBase = process.env.NEXT_PUBLIC_CDN_URL || '/api/images'
  const params = new URLSearchParams({
    url: src,
    w: width.toString(),
    h: height.toString(),
    q: quality.toString(),
    f: format
  })
  
  return `${cdnBase}?${params.toString()}`
}

// Image validation
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 10 * 1024 * 1024 // 10MB
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif']
  
  if (file.size > maxSize) {
    return { valid: false, error: 'File size too large. Maximum 10MB allowed.' }
  }
  
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Only JPEG, PNG, GIF, WebP, and AVIF are allowed.' }
  }
  
  return { valid: true }
}

// Image compression utility
export async function compressImage(file: File, quality: number = 0.8): Promise<File> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    
    img.onload = () => {
      // Calculate new dimensions
      const maxWidth = 1920
      const maxHeight = 1080
      let { width, height } = img
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }
      
      if (height > maxHeight) {
        width = (width * maxHeight) / height
        height = maxHeight
      }
      
      canvas.width = width
      canvas.height = height
      
      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height)
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            })
            resolve(compressedFile)
          } else {
            reject(new Error('Failed to compress image'))
          }
        },
        'image/jpeg',
        quality
      )
    }
    
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}

// Lazy loading intersection observer
export function createImageObserver(callback: (entry: IntersectionObserverEntry) => void) {
  if (typeof window === 'undefined') return null
  
  return new IntersectionObserver(
    (entries) => {
      entries.forEach(callback)
    },
    {
      root: null,
      rootMargin: '50px',
      threshold: 0.1
    }
  )
}

// Image preloading utility
export function preloadImages(urls: string[]): Promise<void[]> {
  return Promise.all(
    urls.map(url => new Promise<void>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve()
      img.onerror = reject
      img.src = url
    }))
  )
}

// Social media image size helpers
export const socialMediaSizes = {
  twitter: {
    profile: { width: 400, height: 400 },
    header: { width: 1500, height: 500 },
    post: { width: 1200, height: 675 },
    card: { width: 800, height: 418 }
  },
  facebook: {
    profile: { width: 180, height: 180 },
    cover: { width: 820, height: 312 },
    post: { width: 1200, height: 630 },
    story: { width: 1080, height: 1920 }
  },
  instagram: {
    profile: { width: 320, height: 320 },
    square: { width: 1080, height: 1080 },
    portrait: { width: 1080, height: 1350 },
    landscape: { width: 1080, height: 566 },
    story: { width: 1080, height: 1920 }
  },
  linkedin: {
    profile: { width: 400, height: 400 },
    company: { width: 1536, height: 768 },
    post: { width: 1200, height: 627 },
    article: { width: 1200, height: 675 }
  }
}

export default {
  responsiveImageSizes,
  imageSizeConfigs,
  imageQuality,
  generateSizes,
  getOptimizedImageProps,
  generateBlurDataURL,
  getOptimalFormat,
  generateCDNUrl,
  validateImageFile,
  compressImage,
  createImageObserver,
  preloadImages,
  socialMediaSizes
}