import { ClientBranding } from '@prisma/client'

// Default theme configuration
const DEFAULT_THEME = {
  title: 'SociallyHub',
  primaryColor: '#3B82F6',
  secondaryColor: '#1E40AF', 
  accentColor: '#10B981',
  fontFamily: 'Inter',
  fontScale: 'normal'
}

// Color scheme presets
export const COLOR_SCHEMES = {
  default: {
    primary: '#3B82F6',
    secondary: '#1E40AF',
    accent: '#10B981'
  },
  purple: {
    primary: '#8B5CF6',
    secondary: '#7C3AED',
    accent: '#A78BFA'
  },
  green: {
    primary: '#10B981',
    secondary: '#059669',
    accent: '#34D399'
  },
  orange: {
    primary: '#F59E0B',
    secondary: '#D97706',
    accent: '#FBBF24'
  },
  pink: {
    primary: '#EC4899',
    secondary: '#DB2777',
    accent: '#F472B6'
  },
  red: {
    primary: '#EF4444',
    secondary: '#DC2626',
    accent: '#F87171'
  }
}

// Font family options
export const FONT_FAMILIES = [
  { value: 'Inter', label: 'Inter (Default)', category: 'sans-serif' },
  { value: 'system-ui', label: 'System UI', category: 'sans-serif' },
  { value: 'Roboto', label: 'Roboto', category: 'sans-serif' },
  { value: 'Open Sans', label: 'Open Sans', category: 'sans-serif' },
  { value: 'Lato', label: 'Lato', category: 'sans-serif' },
  { value: 'Poppins', label: 'Poppins', category: 'sans-serif' },
  { value: 'Montserrat', label: 'Montserrat', category: 'sans-serif' },
  { value: 'Nunito', label: 'Nunito', category: 'sans-serif' },
  { value: 'Source Sans Pro', label: 'Source Sans Pro', category: 'sans-serif' },
  { value: 'Playfair Display', label: 'Playfair Display', category: 'serif' },
  { value: 'Merriweather', label: 'Merriweather', category: 'serif' },
  { value: 'Georgia', label: 'Georgia', category: 'serif' },
  { value: 'JetBrains Mono', label: 'JetBrains Mono', category: 'monospace' },
  { value: 'Fira Code', label: 'Fira Code', category: 'monospace' }
]

// Font scale options
export const FONT_SCALES = [
  { value: 'small', label: 'Small', scale: '0.9' },
  { value: 'normal', label: 'Normal', scale: '1.0' },
  { value: 'large', label: 'Large', scale: '1.1' },
  { value: 'extra-large', label: 'Extra Large', scale: '1.2' }
]

/**
 * Apply branding configuration to document root
 */
export function applyBranding(branding: ClientBranding | null) {
  if (typeof window === 'undefined') return

  const root = document.documentElement
  const config = branding || DEFAULT_THEME

  // Apply CSS custom properties
  root.style.setProperty('--primary-color', config.primaryColor || DEFAULT_THEME.primaryColor)
  root.style.setProperty('--secondary-color', config.secondaryColor || DEFAULT_THEME.secondaryColor)
  root.style.setProperty('--accent-color', config.accentColor || DEFAULT_THEME.accentColor)
  root.style.setProperty('--font-family', config.fontFamily || DEFAULT_THEME.fontFamily)
  
  // Apply font scale
  const fontScale = FONT_SCALES.find(scale => scale.value === config.fontScale)?.scale || '1.0'
  root.style.setProperty('--font-scale', fontScale)

  // Apply custom CSS if provided
  if (config.customCSS) {
    let styleElement = document.getElementById('custom-branding-styles')
    
    if (!styleElement) {
      styleElement = document.createElement('style')
      styleElement.id = 'custom-branding-styles'
      document.head.appendChild(styleElement)
    }
    
    styleElement.textContent = config.customCSS
  }

  // Update page title if provided
  if (config.title && config.title !== DEFAULT_THEME.title) {
    document.title = config.title
  }

  // Update favicon if provided
  if (config.faviconUrl) {
    updateFavicon(config.faviconUrl)
  }
}

/**
 * Update favicon
 */
function updateFavicon(faviconUrl: string) {
  const existingFavicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement
  
  if (existingFavicon) {
    existingFavicon.href = faviconUrl
  } else {
    const link = document.createElement('link')
    link.rel = 'icon'
    link.href = faviconUrl
    document.head.appendChild(link)
  }
}

/**
 * Generate CSS variables object for branding
 */
export function generateCSSVariables(branding: ClientBranding | null): Record<string, string> {
  const config = branding || DEFAULT_THEME
  
  const variables: Record<string, string> = {
    '--primary-color': config.primaryColor || DEFAULT_THEME.primaryColor,
    '--secondary-color': config.secondaryColor || DEFAULT_THEME.secondaryColor,
    '--accent-color': config.accentColor || DEFAULT_THEME.accentColor,
    '--font-family': config.fontFamily || DEFAULT_THEME.fontFamily
  }

  // Add font scale
  const fontScale = FONT_SCALES.find(scale => scale.value === config.fontScale)?.scale || '1.0'
  variables['--font-scale'] = fontScale

  // Add color palette if provided
  if (config.colorPalette && typeof config.colorPalette === 'object') {
    const palette = config.colorPalette as Record<string, any>
    Object.entries(palette).forEach(([key, value]) => {
      if (typeof value === 'string' && value.startsWith('#')) {
        variables[`--${key}`] = value
      }
    })
  }

  return variables
}

/**
 * Generate Tailwind CSS classes for branding
 */
export function generateTailwindClasses(branding: ClientBranding | null): Record<string, string> {
  const config = branding || DEFAULT_THEME
  
  return {
    primary: `bg-[${config.primaryColor}] text-white`,
    secondary: `bg-[${config.secondaryColor}] text-white`,
    accent: `bg-[${config.accentColor}] text-white`,
    primaryText: `text-[${config.primaryColor}]`,
    secondaryText: `text-[${config.secondaryColor}]`,
    accentText: `text-[${config.accentColor}]`,
    primaryBorder: `border-[${config.primaryColor}]`,
    secondaryBorder: `border-[${config.secondaryColor}]`,
    accentBorder: `border-[${config.accentColor}]`
  }
}

/**
 * Validate color format
 */
export function isValidColor(color: string): boolean {
  // Check hex color format
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)
}

/**
 * Convert hex color to RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null
}

/**
 * Convert RGB to hex
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
}

/**
 * Generate color variations (lighter/darker)
 */
export function generateColorVariations(baseColor: string): {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
} {
  const rgb = hexToRgb(baseColor)
  if (!rgb) {
    throw new Error('Invalid color format')
  }

  const variations = {
    50: lightenColor(baseColor, 0.95),
    100: lightenColor(baseColor, 0.9),
    200: lightenColor(baseColor, 0.75),
    300: lightenColor(baseColor, 0.6),
    400: lightenColor(baseColor, 0.3),
    500: baseColor,
    600: darkenColor(baseColor, 0.1),
    700: darkenColor(baseColor, 0.25),
    800: darkenColor(baseColor, 0.4),
    900: darkenColor(baseColor, 0.6)
  }

  return variations
}

/**
 * Lighten a color by a percentage
 */
export function lightenColor(color: string, percentage: number): string {
  const rgb = hexToRgb(color)
  if (!rgb) return color

  const lighten = (value: number) => Math.round(value + (255 - value) * percentage)
  
  return rgbToHex(lighten(rgb.r), lighten(rgb.g), lighten(rgb.b))
}

/**
 * Darken a color by a percentage
 */
export function darkenColor(color: string, percentage: number): string {
  const rgb = hexToRgb(color)
  if (!rgb) return color

  const darken = (value: number) => Math.round(value * (1 - percentage))
  
  return rgbToHex(darken(rgb.r), darken(rgb.g), darken(rgb.b))
}

/**
 * Get contrast ratio between two colors
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1)
  const rgb2 = hexToRgb(color2)
  
  if (!rgb1 || !rgb2) return 1

  const getLuminance = (r: number, g: number, b: number) => {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
  }

  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b)
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b)

  const brightest = Math.max(lum1, lum2)
  const darkest = Math.min(lum1, lum2)

  return (brightest + 0.05) / (darkest + 0.05)
}

/**
 * Check if color provides sufficient contrast for accessibility
 */
export function hasAccessibleContrast(foreground: string, background: string): boolean {
  const ratio = getContrastRatio(foreground, background)
  return ratio >= 4.5 // WCAG AA standard
}

/**
 * Get appropriate text color (black or white) for a background color
 */
export function getTextColor(backgroundColor: string): string {
  const whiteContrast = getContrastRatio('#FFFFFF', backgroundColor)
  const blackContrast = getContrastRatio('#000000', backgroundColor)
  
  return whiteContrast > blackContrast ? '#FFFFFF' : '#000000'
}

/**
 * Apply branding to a specific element
 */
export function applyBrandingToElement(
  element: HTMLElement,
  branding: ClientBranding | null,
  options: {
    applyColors?: boolean
    applyFonts?: boolean
    applyCustomCSS?: boolean
  } = {}
) {
  if (!element) return

  const config = branding || DEFAULT_THEME
  const { applyColors = true, applyFonts = true, applyCustomCSS = false } = options

  if (applyColors) {
    element.style.setProperty('--primary-color', config.primaryColor || DEFAULT_THEME.primaryColor)
    element.style.setProperty('--secondary-color', config.secondaryColor || DEFAULT_THEME.secondaryColor)
    element.style.setProperty('--accent-color', config.accentColor || DEFAULT_THEME.accentColor)
  }

  if (applyFonts) {
    element.style.setProperty('--font-family', config.fontFamily || DEFAULT_THEME.fontFamily)
    const fontScale = FONT_SCALES.find(scale => scale.value === config.fontScale)?.scale || '1.0'
    element.style.setProperty('--font-scale', fontScale)
  }

  if (applyCustomCSS && config.customCSS) {
    // Apply custom CSS as data attribute for scoped styling
    element.setAttribute('data-custom-styles', config.customCSS)
  }
}