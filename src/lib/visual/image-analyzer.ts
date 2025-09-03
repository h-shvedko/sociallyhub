// Advanced Image Analysis Service

import Jimp from 'jimp'
import { prisma } from '@/lib/prisma'

export interface ColorAnalysis {
  dominantColors: string[]
  colorPalette: {
    hex: string
    rgb: { r: number; g: number; b: number }
    hsl: { h: number; s: number; l: number }
    percentage: number
  }[]
  harmony: {
    type: 'monochromatic' | 'analogous' | 'complementary' | 'triadic' | 'split-complementary' | 'tetradic' | 'none'
    score: number
  }
}

export interface CompositionAnalysis {
  ruleOfThirds: {
    score: number
    intersectionPoints: { x: number; y: number; strength: number }[]
  }
  balance: {
    horizontal: number // -1 (left heavy) to 1 (right heavy)
    vertical: number   // -1 (top heavy) to 1 (bottom heavy)
    overall: number    // 0-1 balance score
  }
  contrast: {
    overall: number
    focal: number
    background: number
  }
  symmetry: {
    horizontal: number
    vertical: number
    radial: number
  }
}

export interface AestheticAnalysis {
  overall: number // 0-1 aesthetic score
  factors: {
    colorHarmony: number
    composition: number
    contrast: number
    clarity: number
    noise: number
  }
}

export interface TextAnalysis {
  detected: boolean
  regions: {
    text: string
    confidence: number
    boundingBox: { x: number; y: number; width: number; height: number }
    readability: {
      contrast: number
      fontSize: number
      fontWeight: 'light' | 'normal' | 'bold'
      background: 'light' | 'dark' | 'complex'
    }
  }[]
  overallReadability: number
}

export interface ObjectDetection {
  objects: {
    label: string
    confidence: number
    boundingBox: { x: number; y: number; width: number; height: number }
  }[]
  faces: {
    confidence: number
    boundingBox: { x: number; y: number; width: number; height: number }
    landmarks?: { x: number; y: number }[]
    emotions?: { emotion: string; confidence: number }[]
  }[]
  landmarks: {
    name: string
    confidence: number
    boundingBox: { x: number; y: number; width: number; height: number }
  }[]
}

export interface SafetyAnalysis {
  adult: 'VERY_UNLIKELY' | 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'VERY_LIKELY'
  spoof: 'VERY_UNLIKELY' | 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'VERY_LIKELY'
  medical: 'VERY_UNLIKELY' | 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'VERY_LIKELY'
  violence: 'VERY_UNLIKELY' | 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'VERY_LIKELY'
  racy: 'VERY_UNLIKELY' | 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'VERY_LIKELY'
  safe: boolean
}

export interface BrandAnalysis {
  score: number // 0-1 brand consistency score
  logoDetected: boolean
  brandColors: {
    detected: string[]
    matches: { color: string; confidence: number }[]
    score: number
  }
  fontAnalysis: {
    detected: string[]
    brandCompliant: boolean
    score: number
  }
  styleCompliance: {
    overall: number
    factors: {
      colorScheme: number
      typography: number
      composition: number
      mood: number
    }
  }
}

export class ImageAnalyzer {
  private static instance: ImageAnalyzer
  
  static getInstance(): ImageAnalyzer {
    if (!ImageAnalyzer.instance) {
      ImageAnalyzer.instance = new ImageAnalyzer()
    }
    return ImageAnalyzer.instance
  }

  async analyzeImage(
    imageBuffer: Buffer,
    assetId: string,
    workspaceId: string,
    options: {
      analyzeColors?: boolean
      analyzeComposition?: boolean
      analyzeText?: boolean
      analyzeObjects?: boolean
      analyzeSafety?: boolean
      analyzeBrand?: boolean
      brandGuidelines?: any
    } = {}
  ) {
    try {
      const image = await Jimp.read(imageBuffer)
      const { width, height } = image.bitmap

      const analysis: any = {
        width,
        height,
        format: image.getMIME().split('/')[1],
        fileSize: imageBuffer.length,
      }

      // Color analysis
      if (options.analyzeColors !== false) {
        analysis.colorAnalysis = await this.analyzeColors(image)
        analysis.dominantColors = analysis.colorAnalysis.dominantColors
        analysis.colorPalette = analysis.colorAnalysis.colorPalette
      }

      // Composition analysis
      if (options.analyzeComposition !== false) {
        analysis.compositionAnalysis = await this.analyzeComposition(image)
        analysis.compositonScore = analysis.compositionAnalysis.overall || 0.5
      }

      // Aesthetic analysis
      analysis.aestheticAnalysis = await this.analyzeAesthetics(image)
      analysis.aestheticScore = analysis.aestheticAnalysis.overall

      // Text analysis (OCR)
      if (options.analyzeText !== false) {
        analysis.textAnalysis = await this.analyzeText(image)
        analysis.text = analysis.textAnalysis.regions || []
      }

      // Object detection
      if (options.analyzeObjects !== false) {
        analysis.objectDetection = await this.analyzeObjects(image)
        analysis.labels = analysis.objectDetection.objects || []
        analysis.faces = analysis.objectDetection.faces || []
        analysis.landmarks = analysis.objectDetection.landmarks || []
      }

      // Safety analysis
      if (options.analyzeSafety !== false) {
        analysis.safetyAnalysis = await this.analyzeSafety(image)
        analysis.safeSearch = analysis.safetyAnalysis
      }

      // Brand analysis
      if (options.analyzeBrand !== false && options.brandGuidelines) {
        analysis.brandAnalysis = await this.analyzeBrand(image, options.brandGuidelines)
        analysis.brandScore = analysis.brandAnalysis.score
        analysis.logoDetected = analysis.brandAnalysis.logoDetected
        analysis.brandColors = analysis.brandAnalysis.brandColors
        analysis.fontAnalysis = analysis.brandAnalysis.fontAnalysis
      }

      // Save to database
      const imageAnalysis = await prisma.imageAnalysis.create({
        data: {
          assetId,
          workspaceId,
          width,
          height,
          format: analysis.format,
          fileSize: analysis.fileSize,
          dominantColors: analysis.dominantColors || [],
          colorPalette: analysis.colorPalette || [],
          labels: analysis.labels || [],
          faces: analysis.faces || [],
          text: analysis.text || [],
          safeSearch: analysis.safeSearch || {},
          landmarks: analysis.landmarks || [],
          brandScore: analysis.brandScore || null,
          logoDetected: analysis.logoDetected || false,
          brandColors: analysis.brandColors || null,
          fontAnalysis: analysis.fontAnalysis || null,
          aestheticScore: analysis.aestheticScore || null,
          compositonScore: analysis.compositonScore || null,
        }
      })

      return {
        id: imageAnalysis.id,
        ...analysis
      }

    } catch (error) {
      console.error('Image analysis failed:', error)
      throw new Error(`Image analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async analyzeColors(image: Jimp): Promise<ColorAnalysis> {
    const colorMap = new Map<string, number>()
    const width = image.bitmap.width
    const height = image.bitmap.height
    
    // Sample colors from the image (every 10th pixel for performance)
    for (let y = 0; y < height; y += 10) {
      for (let x = 0; x < width; x += 10) {
        const rgba = image.getPixelColor(x, y)
        const hex = '#' + rgba.toString(16).slice(0, 6).padStart(6, '0')
        colorMap.set(hex, (colorMap.get(hex) || 0) + 1)
      }
    }

    // Get dominant colors
    const sortedColors = Array.from(colorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)

    const totalPixels = sortedColors.reduce((sum, [, count]) => sum + count, 0)
    
    const colorPalette = sortedColors.map(([hex, count]) => {
      const rgb = this.hexToRgb(hex)
      const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b)
      
      return {
        hex,
        rgb,
        hsl,
        percentage: (count / totalPixels) * 100
      }
    })

    const dominantColors = colorPalette.slice(0, 5).map(c => c.hex)

    // Analyze color harmony
    const harmony = this.analyzeColorHarmony(colorPalette.slice(0, 3))

    return {
      dominantColors,
      colorPalette,
      harmony
    }
  }

  private async analyzeComposition(image: Jimp): Promise<CompositionAnalysis> {
    const width = image.bitmap.width
    const height = image.bitmap.height

    // Rule of thirds analysis
    const ruleOfThirds = this.analyzeRuleOfThirds(image)
    
    // Balance analysis
    const balance = this.analyzeBalance(image)
    
    // Contrast analysis
    const contrast = this.analyzeContrast(image)
    
    // Symmetry analysis
    const symmetry = this.analyzeSymmetry(image)

    return {
      ruleOfThirds,
      balance,
      contrast,
      symmetry
    }
  }

  private async analyzeAesthetics(image: Jimp): Promise<AestheticAnalysis> {
    // Simplified aesthetic analysis based on various factors
    const colorAnalysis = await this.analyzeColors(image)
    const compositionAnalysis = await this.analyzeComposition(image)
    
    const factors = {
      colorHarmony: colorAnalysis.harmony.score,
      composition: (compositionAnalysis.ruleOfThirds.score + compositionAnalysis.balance.overall) / 2,
      contrast: compositionAnalysis.contrast.overall,
      clarity: this.analyzeClarity(image),
      noise: 1 - this.analyzeNoise(image)
    }

    const overall = Object.values(factors).reduce((sum, score) => sum + score, 0) / Object.keys(factors).length

    return {
      overall: Math.max(0, Math.min(1, overall)),
      factors
    }
  }

  private async analyzeText(image: Jimp): Promise<TextAnalysis> {
    // Basic text detection using edge detection and pattern recognition
    // This is a simplified version - in production, use Google Vision API or similar
    
    const grayImage = image.clone().grayscale()
    const edges = this.detectEdges(grayImage)
    
    // Look for text-like patterns
    const textRegions = this.findTextRegions(edges)
    
    const regions = textRegions.map(region => ({
      text: 'Detected Text', // Placeholder - would need OCR
      confidence: region.confidence,
      boundingBox: region.boundingBox,
      readability: this.analyzeReadability(image, region.boundingBox)
    }))

    const overallReadability = regions.length > 0 
      ? regions.reduce((sum, r) => sum + r.readability.contrast, 0) / regions.length
      : 0

    return {
      detected: regions.length > 0,
      regions,
      overallReadability
    }
  }

  private async analyzeObjects(image: Jimp): Promise<ObjectDetection> {
    // Simplified object detection - in production, use computer vision API
    // This would typically use TensorFlow.js or cloud APIs
    
    return {
      objects: [], // Placeholder
      faces: [], // Placeholder
      landmarks: [] // Placeholder
    }
  }

  private async analyzeSafety(image: Jimp): Promise<SafetyAnalysis> {
    // Basic safety analysis - in production, use cloud APIs
    // This is a simplified heuristic-based approach
    
    const colorAnalysis = await this.analyzeColors(image)
    const hasRedFlag = colorAnalysis.dominantColors.some(color => 
      this.isRedFlag(color)
    )

    return {
      adult: hasRedFlag ? 'POSSIBLE' : 'VERY_UNLIKELY',
      spoof: 'VERY_UNLIKELY',
      medical: 'VERY_UNLIKELY',
      violence: hasRedFlag ? 'POSSIBLE' : 'VERY_UNLIKELY',
      racy: 'VERY_UNLIKELY',
      safe: !hasRedFlag
    }
  }

  private async analyzeBrand(image: Jimp, brandGuidelines: any): Promise<BrandAnalysis> {
    const colorAnalysis = await this.analyzeColors(image)
    
    // Check brand colors
    const brandColorMatches = this.checkBrandColors(
      colorAnalysis.dominantColors,
      brandGuidelines.primaryColors || []
    )

    const brandScore = brandColorMatches.score

    return {
      score: brandScore,
      logoDetected: false, // Placeholder
      brandColors: brandColorMatches,
      fontAnalysis: {
        detected: [],
        brandCompliant: true,
        score: 0.8
      },
      styleCompliance: {
        overall: brandScore,
        factors: {
          colorScheme: brandColorMatches.score,
          typography: 0.8,
          composition: 0.7,
          mood: 0.6
        }
      }
    }
  }

  // Helper methods
  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 }
  }

  private rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255
    g /= 255
    b /= 255
    
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h = 0, s = 0, l = (max + min) / 2

    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break
        case g: h = (b - r) / d + 2; break
        case b: h = (r - g) / d + 4; break
      }
      h /= 6
    }

    return { h: h * 360, s: s * 100, l: l * 100 }
  }

  private analyzeColorHarmony(colors: any[]): { type: string; score: number } {
    if (colors.length < 2) {
      return { type: 'none', score: 0.5 }
    }

    // Simplified harmony analysis
    const hues = colors.map(c => c.hsl.h)
    
    // Check for complementary colors (opposite hues)
    const isComplementary = hues.some((h1, i) => 
      hues.some((h2, j) => i !== j && Math.abs(h1 - h2) > 150 && Math.abs(h1 - h2) < 210)
    )
    
    if (isComplementary) {
      return { type: 'complementary', score: 0.8 }
    }

    // Check for analogous colors (similar hues)
    const maxHueDiff = Math.max(...hues) - Math.min(...hues)
    if (maxHueDiff < 60) {
      return { type: 'analogous', score: 0.7 }
    }

    return { type: 'none', score: 0.5 }
  }

  private analyzeRuleOfThirds(image: Jimp): { score: number; intersectionPoints: any[] } {
    const width = image.bitmap.width
    const height = image.bitmap.height
    
    // Rule of thirds intersection points
    const intersections = [
      { x: width / 3, y: height / 3 },
      { x: (width * 2) / 3, y: height / 3 },
      { x: width / 3, y: (height * 2) / 3 },
      { x: (width * 2) / 3, y: (height * 2) / 3 }
    ]

    // Simplified scoring - check for interesting content near intersections
    let score = 0
    const intersectionPoints = intersections.map(point => {
      const strength = this.getInterestStrength(image, point.x, point.y)
      score += strength
      return { ...point, strength }
    })

    return {
      score: Math.min(1, score / intersections.length),
      intersectionPoints
    }
  }

  private analyzeBalance(image: Jimp): any {
    const width = image.bitmap.width
    const height = image.bitmap.height
    
    let leftWeight = 0, rightWeight = 0
    let topWeight = 0, bottomWeight = 0
    
    // Sample image to calculate visual weight distribution
    for (let y = 0; y < height; y += 5) {
      for (let x = 0; x < width; x += 5) {
        const rgba = image.getPixelColor(x, y)
        const brightness = this.getBrightness(rgba)
        const weight = 1 - brightness // Dark areas have more visual weight
        
        if (x < width / 2) leftWeight += weight
        else rightWeight += weight
        
        if (y < height / 2) topWeight += weight
        else bottomWeight += weight
      }
    }

    const totalWeight = leftWeight + rightWeight
    const horizontal = totalWeight > 0 ? (rightWeight - leftWeight) / totalWeight : 0
    
    const verticalTotal = topWeight + bottomWeight
    const vertical = verticalTotal > 0 ? (bottomWeight - topWeight) / verticalTotal : 0
    
    const overall = 1 - (Math.abs(horizontal) + Math.abs(vertical)) / 2

    return { horizontal, vertical, overall }
  }

  private analyzeContrast(image: Jimp): any {
    let totalContrast = 0
    let samples = 0
    const width = image.bitmap.width
    const height = image.bitmap.height

    // Sample contrast across the image
    for (let y = 0; y < height; y += 10) {
      for (let x = 0; x < width - 1; x += 10) {
        const pixel1 = this.getBrightness(image.getPixelColor(x, y))
        const pixel2 = this.getBrightness(image.getPixelColor(x + 1, y))
        totalContrast += Math.abs(pixel1 - pixel2)
        samples++
      }
    }

    const overall = samples > 0 ? totalContrast / samples : 0

    return {
      overall: Math.min(1, overall * 2), // Normalize
      focal: overall * 1.2, // Placeholder
      background: overall * 0.8 // Placeholder
    }
  }

  private analyzeSymmetry(image: Jimp): any {
    // Simplified symmetry analysis
    return {
      horizontal: 0.5, // Placeholder
      vertical: 0.5,   // Placeholder
      radial: 0.3      // Placeholder
    }
  }

  private analyzeClarity(image: Jimp): number {
    // Simple clarity measure based on edge strength
    const edges = this.detectEdges(image.clone().grayscale())
    let edgeStrength = 0
    let samples = 0

    const width = edges.bitmap.width
    const height = edges.bitmap.height

    for (let y = 0; y < height; y += 5) {
      for (let x = 0; x < width; x += 5) {
        const brightness = this.getBrightness(edges.getPixelColor(x, y))
        edgeStrength += brightness
        samples++
      }
    }

    return samples > 0 ? Math.min(1, edgeStrength / samples * 2) : 0
  }

  private analyzeNoise(image: Jimp): number {
    // Simple noise detection
    let noise = 0
    let samples = 0
    const width = image.bitmap.width
    const height = image.bitmap.height

    for (let y = 1; y < height - 1; y += 5) {
      for (let x = 1; x < width - 1; x += 5) {
        const center = this.getBrightness(image.getPixelColor(x, y))
        const neighbors = [
          this.getBrightness(image.getPixelColor(x - 1, y)),
          this.getBrightness(image.getPixelColor(x + 1, y)),
          this.getBrightness(image.getPixelColor(x, y - 1)),
          this.getBrightness(image.getPixelColor(x, y + 1))
        ]
        
        const avgNeighbor = neighbors.reduce((sum, b) => sum + b, 0) / neighbors.length
        noise += Math.abs(center - avgNeighbor)
        samples++
      }
    }

    return samples > 0 ? Math.min(1, noise / samples * 3) : 0
  }

  private detectEdges(image: Jimp): Jimp {
    const width = image.bitmap.width
    const height = image.bitmap.height
    const result = image.clone()

    // Simple Sobel edge detection
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const gx = 
          -this.getBrightness(image.getPixelColor(x - 1, y - 1)) +
           this.getBrightness(image.getPixelColor(x + 1, y - 1)) +
          -2 * this.getBrightness(image.getPixelColor(x - 1, y)) +
           2 * this.getBrightness(image.getPixelColor(x + 1, y)) +
          -this.getBrightness(image.getPixelColor(x - 1, y + 1)) +
           this.getBrightness(image.getPixelColor(x + 1, y + 1))

        const gy = 
          -this.getBrightness(image.getPixelColor(x - 1, y - 1)) +
          -2 * this.getBrightness(image.getPixelColor(x, y - 1)) +
          -this.getBrightness(image.getPixelColor(x + 1, y - 1)) +
           this.getBrightness(image.getPixelColor(x - 1, y + 1)) +
           2 * this.getBrightness(image.getPixelColor(x, y + 1)) +
           this.getBrightness(image.getPixelColor(x + 1, y + 1))

        const magnitude = Math.sqrt(gx * gx + gy * gy)
        const normalizedMagnitude = Math.min(255, magnitude * 255)
        
        result.setPixelColor(
          Jimp.rgbaToInt(normalizedMagnitude, normalizedMagnitude, normalizedMagnitude, 255),
          x,
          y
        )
      }
    }

    return result
  }

  private findTextRegions(edgeImage: Jimp): any[] {
    // Simplified text region detection
    // In production, this would use more sophisticated algorithms
    return []
  }

  private analyzeReadability(image: Jimp, boundingBox: any): any {
    return {
      contrast: 0.8,
      fontSize: 16,
      fontWeight: 'normal' as const,
      background: 'light' as const
    }
  }

  private getInterestStrength(image: Jimp, x: number, y: number): number {
    // Calculate interest/attention strength at a point
    const radius = 20
    let contrast = 0
    let samples = 0

    for (let dy = -radius; dy <= radius; dy += 5) {
      for (let dx = -radius; dx <= radius; dx += 5) {
        const nx = Math.max(0, Math.min(image.bitmap.width - 1, x + dx))
        const ny = Math.max(0, Math.min(image.bitmap.height - 1, y + dy))
        
        const centerBrightness = this.getBrightness(image.getPixelColor(x, y))
        const neighborBrightness = this.getBrightness(image.getPixelColor(nx, ny))
        
        contrast += Math.abs(centerBrightness - neighborBrightness)
        samples++
      }
    }

    return samples > 0 ? Math.min(1, contrast / samples * 3) : 0
  }

  private getBrightness(rgba: number): number {
    const r = (rgba >>> 24) & 0xff
    const g = (rgba >>> 16) & 0xff
    const b = (rgba >>> 8) & 0xff
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255
  }

  private isRedFlag(color: string): boolean {
    // Basic heuristic for potentially inappropriate colors
    const rgb = this.hexToRgb(color)
    const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b)
    
    // Very saturated reds might indicate inappropriate content
    return hsl.h > 350 || hsl.h < 10 && hsl.s > 80 && hsl.l > 30
  }

  private checkBrandColors(imageColors: string[], brandColors: string[]): any {
    if (brandColors.length === 0) {
      return { detected: [], matches: [], score: 0.5 }
    }

    const matches = brandColors.map(brandColor => {
      const bestMatch = imageColors.find(imageColor => 
        this.colorDistance(brandColor, imageColor) < 50
      )
      
      return {
        color: brandColor,
        confidence: bestMatch ? this.colorSimilarity(brandColor, bestMatch) : 0
      }
    })

    const score = matches.reduce((sum, match) => sum + match.confidence, 0) / matches.length

    return {
      detected: imageColors,
      matches,
      score
    }
  }

  private colorDistance(color1: string, color2: string): number {
    const rgb1 = this.hexToRgb(color1)
    const rgb2 = this.hexToRgb(color2)
    
    return Math.sqrt(
      Math.pow(rgb1.r - rgb2.r, 2) +
      Math.pow(rgb1.g - rgb2.g, 2) +
      Math.pow(rgb1.b - rgb2.b, 2)
    )
  }

  private colorSimilarity(color1: string, color2: string): number {
    const distance = this.colorDistance(color1, color2)
    return Math.max(0, 1 - distance / 441.673) // 441.673 is max distance in RGB
  }
}