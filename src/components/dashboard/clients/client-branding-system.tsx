'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import {
  Palette,
  Upload,
  Eye,
  Download,
  Copy,
  Save,
  RefreshCw,
  Image,
  Type,
  Layout,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  Code,
  FileText,
  Link
} from 'lucide-react'
import { Client, ClientBranding, BrandGuidelines } from '@/types/client'

interface ClientBrandingSystemProps {
  client: Client
  onSave?: (branding: ClientBranding) => void
  onPreview?: (branding: ClientBranding) => void
}

export function ClientBrandingSystem({ 
  client, 
  onSave, 
  onPreview 
}: ClientBrandingSystemProps) {
  const [branding, setBranding] = useState<ClientBranding>(client.branding || {
    primaryColor: '#1f2937',
    secondaryColor: '#3b82f6',
    whiteLabel: false,
    brandGuidelines: {
      fonts: ['Inter', 'Roboto'],
      colorPalette: ['#1f2937', '#3b82f6', '#ef4444', '#10b981'],
      voiceAndTone: 'Professional and friendly',
      doAndDonts: []
    }
  })
  
  const [activeTab, setActiveTab] = useState('colors')
  const [previewMode, setPreviewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [isLoading, setIsLoading] = useState(false)

  const colorPresets = [
    { name: 'Corporate Blue', primary: '#1f2937', secondary: '#3b82f6' },
    { name: 'Professional Green', primary: '#065f46', secondary: '#10b981' },
    { name: 'Creative Purple', primary: '#581c87', secondary: '#a855f7' },
    { name: 'Modern Orange', primary: '#ea580c', secondary: '#fb923c' },
    { name: 'Elegant Teal', primary: '#0f766e', secondary: '#14b8a6' },
    { name: 'Classic Red', primary: '#dc2626', secondary: '#ef4444' }
  ]

  const fontOptions = [
    'Inter',
    'Roboto',
    'Open Sans',
    'Montserrat',
    'Lato',
    'Poppins',
    'Source Sans Pro',
    'Nunito',
    'Raleway',
    'Playfair Display'
  ]

  const handleColorChange = (type: 'primary' | 'secondary', color: string) => {
    setBranding(prev => ({
      ...prev,
      [type === 'primary' ? 'primaryColor' : 'secondaryColor']: color
    }))
  }

  const handlePresetSelect = (preset: typeof colorPresets[0]) => {
    setBranding(prev => ({
      ...prev,
      primaryColor: preset.primary,
      secondaryColor: preset.secondary
    }))
  }

  const handleFontChange = (fonts: string[]) => {
    setBranding(prev => ({
      ...prev,
      brandGuidelines: {
        ...prev.brandGuidelines,
        fonts
      }
    }))
  }

  const handleSave = async () => {
    setIsLoading(true)
    try {
      await onSave?.(branding)
    } finally {
      setIsLoading(false)
    }
  }

  const generateCSS = () => {
    return `
/* ${client.name} - Custom Branding */
:root {
  --primary-color: ${branding.primaryColor};
  --secondary-color: ${branding.secondaryColor};
  --primary-font: ${branding.brandGuidelines?.fonts?.[0] || 'Inter'};
  --secondary-font: ${branding.brandGuidelines?.fonts?.[1] || 'Roboto'};
}

.brand-primary {
  color: var(--primary-color);
}

.brand-secondary {
  color: var(--secondary-color);
}

.bg-brand-primary {
  background-color: var(--primary-color);
}

.bg-brand-secondary {
  background-color: var(--secondary-color);
}

.font-brand-primary {
  font-family: var(--primary-font), sans-serif;
}

.font-brand-secondary {
  font-family: var(--secondary-font), sans-serif;
}
    `.trim()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Brand Management</h2>
          <p className="text-sm text-muted-foreground">
            Customize branding and visual identity for {client.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onPreview?.(branding)}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isLoading}>
            {isLoading ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Brand Configuration */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="colors">Colors</TabsTrigger>
              <TabsTrigger value="typography">Typography</TabsTrigger>
              <TabsTrigger value="assets">Assets</TabsTrigger>
              <TabsTrigger value="guidelines">Guidelines</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="colors" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Color Palette</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Primary and Secondary Colors */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Primary Color</Label>
                      <div className="flex gap-2 mt-2">
                        <div 
                          className="w-12 h-12 rounded-lg border-2 border-border"
                          style={{ backgroundColor: branding.primaryColor }}
                        />
                        <div className="flex-1 space-y-2">
                          <Input 
                            type="color" 
                            value={branding.primaryColor}
                            onChange={(e) => handleColorChange('primary', e.target.value)}
                            className="w-full h-8"
                          />
                          <Input 
                            placeholder="#000000"
                            value={branding.primaryColor}
                            onChange={(e) => handleColorChange('primary', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <Label>Secondary Color</Label>
                      <div className="flex gap-2 mt-2">
                        <div 
                          className="w-12 h-12 rounded-lg border-2 border-border"
                          style={{ backgroundColor: branding.secondaryColor }}
                        />
                        <div className="flex-1 space-y-2">
                          <Input 
                            type="color" 
                            value={branding.secondaryColor}
                            onChange={(e) => handleColorChange('secondary', e.target.value)}
                            className="w-full h-8"
                          />
                          <Input 
                            placeholder="#000000"
                            value={branding.secondaryColor}
                            onChange={(e) => handleColorChange('secondary', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Color Presets */}
                  <div>
                    <Label className="mb-3 block">Quick Presets</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {colorPresets.map((preset) => (
                        <Button
                          key={preset.name}
                          variant="outline"
                          className="h-auto p-3"
                          onClick={() => handlePresetSelect(preset)}
                        >
                          <div className="flex items-center gap-3 w-full">
                            <div className="flex gap-1">
                              <div 
                                className="w-4 h-4 rounded"
                                style={{ backgroundColor: preset.primary }}
                              />
                              <div 
                                className="w-4 h-4 rounded"
                                style={{ backgroundColor: preset.secondary }}
                              />
                            </div>
                            <span className="text-xs">{preset.name}</span>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Extended Palette */}
                  <div>
                    <Label>Extended Color Palette</Label>
                    <div className="grid grid-cols-6 gap-2 mt-2">
                      {branding.brandGuidelines?.colorPalette?.map((color, index) => (
                        <div key={index} className="space-y-1">
                          <div 
                            className="w-full h-12 rounded border"
                            style={{ backgroundColor: color }}
                          />
                          <Input 
                            value={color}
                            onChange={(e) => {
                              const newPalette = [...(branding.brandGuidelines?.colorPalette || [])]
                              newPalette[index] = e.target.value
                              setBranding(prev => ({
                                ...prev,
                                brandGuidelines: {
                                  ...prev.brandGuidelines,
                                  colorPalette: newPalette
                                }
                              }))
                            }}
                            className="text-xs"
                          />
                        </div>
                      ))}
                      <Button 
                        variant="outline" 
                        className="h-12"
                        onClick={() => {
                          setBranding(prev => ({
                            ...prev,
                            brandGuidelines: {
                              ...prev.brandGuidelines,
                              colorPalette: [...(prev.brandGuidelines?.colorPalette || []), '#ffffff']
                            }
                          }))
                        }}
                      >
                        <Palette className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="typography" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Typography</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Primary Font</Label>
                    <Select 
                      value={branding.brandGuidelines?.fonts?.[0] || ''}
                      onValueChange={(value) => {
                        const fonts = branding.brandGuidelines?.fonts || []
                        fonts[0] = value
                        handleFontChange(fonts)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select primary font" />
                      </SelectTrigger>
                      <SelectContent>
                        {fontOptions.map((font) => (
                          <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                            {font}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Secondary Font</Label>
                    <Select 
                      value={branding.brandGuidelines?.fonts?.[1] || ''}
                      onValueChange={(value) => {
                        const fonts = branding.brandGuidelines?.fonts || ['', '']
                        fonts[1] = value
                        handleFontChange(fonts)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select secondary font" />
                      </SelectTrigger>
                      <SelectContent>
                        {fontOptions.map((font) => (
                          <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                            {font}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Font Preview */}
                  <div className="space-y-4 p-4 border rounded-lg">
                    <div style={{ fontFamily: branding.brandGuidelines?.fonts?.[0] }}>
                      <h3 className="text-xl font-bold mb-2">Primary Font Preview</h3>
                      <p>The quick brown fox jumps over the lazy dog. 1234567890</p>
                    </div>
                    <div style={{ fontFamily: branding.brandGuidelines?.fonts?.[1] }}>
                      <h3 className="text-lg font-semibold mb-2">Secondary Font Preview</h3>
                      <p>The quick brown fox jumps over the lazy dog. 1234567890</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="assets" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Brand Assets</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Logo Upload */}
                  <div>
                    <Label>Logo</Label>
                    <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8">
                      {branding.logo ? (
                        <div className="text-center space-y-2">
                          <img 
                            src={branding.logo} 
                            alt="Logo" 
                            className="max-h-16 mx-auto"
                          />
                          <Button variant="outline" size="sm">
                            <Upload className="h-4 w-4 mr-2" />
                            Replace Logo
                          </Button>
                        </div>
                      ) : (
                        <div className="text-center">
                          <Upload className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            Upload your logo
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            SVG, PNG, JPG up to 10MB
                          </p>
                          <Button variant="outline" size="sm" className="mt-2">
                            Choose File
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Favicon */}
                  <div>
                    <Label>Favicon</Label>
                    <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4">
                      <div className="text-center">
                        <Image className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Upload favicon (32x32 or 16x16)
                        </p>
                        <Button variant="outline" size="sm" className="mt-2">
                          Choose File
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Custom Domain */}
                  <div>
                    <Label>Custom Domain</Label>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="custom.domain.com"
                        value={branding.customDomain || ''}
                        onChange={(e) => setBranding(prev => ({ 
                          ...prev, 
                          customDomain: e.target.value || undefined 
                        }))}
                      />
                      <Button variant="outline">
                        <Link className="h-4 w-4 mr-2" />
                        Verify
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="guidelines" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Brand Guidelines</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Voice & Tone</Label>
                    <Textarea 
                      placeholder="Describe your brand's voice and tone..."
                      value={branding.brandGuidelines?.voiceAndTone || ''}
                      onChange={(e) => setBranding(prev => ({
                        ...prev,
                        brandGuidelines: {
                          ...prev.brandGuidelines,
                          voiceAndTone: e.target.value
                        }
                      }))}
                    />
                  </div>

                  <div>
                    <Label>Logo Usage Guidelines</Label>
                    <Textarea 
                      placeholder="Guidelines for logo usage, sizing, placement..."
                      value={branding.brandGuidelines?.logoUsage || ''}
                      onChange={(e) => setBranding(prev => ({
                        ...prev,
                        brandGuidelines: {
                          ...prev.brandGuidelines,
                          logoUsage: e.target.value
                        }
                      }))}
                    />
                  </div>

                  <div>
                    <Label>Imagery Guidelines</Label>
                    <Textarea 
                      placeholder="Style, colors, composition guidelines for images..."
                      value={branding.brandGuidelines?.imagery || ''}
                      onChange={(e) => setBranding(prev => ({
                        ...prev,
                        brandGuidelines: {
                          ...prev.brandGuidelines,
                          imagery: e.target.value
                        }
                      }))}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Branding Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="whiteLabel"
                      checked={branding.whiteLabel}
                      onCheckedChange={(checked) => setBranding(prev => ({ 
                        ...prev, 
                        whiteLabel: checked as boolean 
                      }))}
                    />
                    <Label htmlFor="whiteLabel">
                      Enable white-label branding
                    </Label>
                  </div>

                  <div>
                    <Label>Custom CSS</Label>
                    <Textarea 
                      placeholder="/* Custom CSS overrides */"
                      value={branding.customCSS || ''}
                      onChange={(e) => setBranding(prev => ({ 
                        ...prev, 
                        customCSS: e.target.value || undefined 
                      }))}
                      rows={8}
                      className="font-mono text-sm"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => navigator.clipboard.writeText(generateCSS())}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy CSS
                    </Button>
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Download Assets
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Preview Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Live Preview</CardTitle>
                <div className="flex items-center gap-1">
                  <Button 
                    variant={previewMode === 'desktop' ? 'default' : 'ghost'} 
                    size="sm"
                    onClick={() => setPreviewMode('desktop')}
                  >
                    <Monitor className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant={previewMode === 'tablet' ? 'default' : 'ghost'} 
                    size="sm"
                    onClick={() => setPreviewMode('tablet')}
                  >
                    <Tablet className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant={previewMode === 'mobile' ? 'default' : 'ghost'} 
                    size="sm"
                    onClick={() => setPreviewMode('mobile')}
                  >
                    <Smartphone className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div 
                className={`border rounded-lg overflow-hidden ${
                  previewMode === 'mobile' ? 'max-w-xs mx-auto' : 
                  previewMode === 'tablet' ? 'max-w-md mx-auto' : ''
                }`}
              >
                {/* Mock Dashboard Preview */}
                <div 
                  className="p-4 text-white"
                  style={{ backgroundColor: branding.primaryColor }}
                >
                  <div className="flex items-center gap-2">
                    {branding.logo && (
                      <img src={branding.logo} alt="Logo" className="h-6" />
                    )}
                    <h3 
                      className="font-bold"
                      style={{ fontFamily: branding.brandGuidelines?.fonts?.[0] }}
                    >
                      {client.name}
                    </h3>
                  </div>
                </div>
                
                <div className="p-4 space-y-4">
                  <div 
                    className="text-lg font-semibold"
                    style={{ 
                      color: branding.primaryColor,
                      fontFamily: branding.brandGuidelines?.fonts?.[0]
                    }}
                  >
                    Dashboard Preview
                  </div>
                  
                  <div className="space-y-2">
                    <div 
                      className="h-8 rounded"
                      style={{ backgroundColor: branding.secondaryColor + '20' }}
                    />
                    <div 
                      className="h-6 w-3/4 rounded"
                      style={{ backgroundColor: branding.primaryColor + '10' }}
                    />
                    <div 
                      className="h-6 w-1/2 rounded"
                      style={{ backgroundColor: branding.secondaryColor + '10' }}
                    />
                  </div>
                  
                  <button 
                    className="px-4 py-2 rounded text-white text-sm"
                    style={{ backgroundColor: branding.secondaryColor }}
                  >
                    Sample Button
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CSS Export */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Code className="h-4 w-4" />
                Generated CSS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-3 rounded text-xs font-mono overflow-auto max-h-48">
                <pre>{generateCSS()}</pre>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2 w-full"
                onClick={() => navigator.clipboard.writeText(generateCSS())}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy CSS
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}