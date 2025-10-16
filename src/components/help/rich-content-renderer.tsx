'use client'

import { useState, useEffect, useRef } from 'react'
import { marked } from 'marked'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Copy,
  Check,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  ExternalLink,
  Image as ImageIcon,
  FileText,
  Download
} from 'lucide-react'

interface TableOfContentsItem {
  id: string
  title: string
  level: number
}

interface RichContentRendererProps {
  content: string
  showTableOfContents?: boolean
  className?: string
}

// Function to detect if content is markdown and convert to HTML
function convertMarkdownToHtml(content: string): string {
  // Simple detection: if content contains markdown patterns, convert it
  const markdownPatterns = [
    /^#{1,6}\s/m,          // Headers
    /\*\*.*?\*\*/,         // Bold
    /\*.*?\*/,             // Italic
    /^\- /m,               // Unordered lists
    /^\d+\. /m,            // Ordered lists
    /^\> /m,               // Blockquotes
    /`.*?`/,               // Inline code
    /```[\s\S]*?```/       // Code blocks
  ]

  const isMarkdown = markdownPatterns.some(pattern => pattern.test(content))

  if (isMarkdown) {
    // Configure marked options for better security and formatting
    marked.setOptions({
      gfm: true,
      breaks: true,
      sanitize: false, // We'll handle sanitization at the component level
      smartypants: true
    })

    return marked(content) as string
  }

  // If it's already HTML or plain text, return as is
  return content
}

export function RichContentRenderer({
  content,
  showTableOfContents = true,
  className = ''
}: RichContentRendererProps) {
  const [tocItems, setTocItems] = useState<TableOfContentsItem[]>([])
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (contentRef.current && showTableOfContents) {
      generateTableOfContents()
    }
  }, [content, showTableOfContents])

  const generateTableOfContents = () => {
    if (!contentRef.current) return

    const headings = contentRef.current.querySelectorAll('h1, h2, h3, h4, h5, h6')
    const items: TableOfContentsItem[] = []

    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName.charAt(1))
      const title = heading.textContent || ''
      const id = `heading-${index}-${title.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '-')}`

      // Add ID to the heading for anchor links
      heading.id = id

      items.push({ id, title, level })
    })

    setTocItems(items)
  }

  const copyToClipboard = async (text: string, codeId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedCode(codeId)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch (err) {
      console.error('Failed to copy text:', err)
    }
  }

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Process the content to add rich media support
  const processContent = (htmlContent: string) => {
    // Create a temporary div to parse the HTML
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = htmlContent

    // Process code blocks
    const codeBlocks = tempDiv.querySelectorAll('pre code, code')
    codeBlocks.forEach((codeBlock, index) => {
      const isInline = codeBlock.tagName === 'CODE' && codeBlock.parentElement?.tagName !== 'PRE'
      const codeContent = codeBlock.textContent || ''
      const codeId = `code-${index}`

      if (!isInline && codeContent.length > 20) {
        // Detect language from class name (e.g., language-javascript)
        const languageClass = Array.from(codeBlock.classList).find(cls => cls.startsWith('language-'))
        const language = languageClass ? languageClass.replace('language-', '') : 'text'

        // Replace with a placeholder that we'll process later
        const placeholder = document.createElement('div')
        placeholder.setAttribute('data-code-block', codeId)
        placeholder.setAttribute('data-language', language)
        placeholder.setAttribute('data-code', codeContent)
        placeholder.className = 'code-block-placeholder'

        if (codeBlock.parentElement?.tagName === 'PRE') {
          codeBlock.parentElement.replaceWith(placeholder)
        } else {
          codeBlock.replaceWith(placeholder)
        }
      }
    })

    // Process images to add responsive behavior
    const images = tempDiv.querySelectorAll('img')
    images.forEach((img) => {
      img.className = 'max-w-full h-auto rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer'
      img.setAttribute('loading', 'lazy')

      // Wrap images in a figure for better styling
      const figure = document.createElement('figure')
      figure.className = 'my-6'
      img.parentNode?.insertBefore(figure, img)
      figure.appendChild(img)

      // Add alt text as caption if available
      if (img.alt) {
        const caption = document.createElement('figcaption')
        caption.className = 'text-sm text-gray-600 text-center mt-2 italic'
        caption.textContent = img.alt
        figure.appendChild(caption)
      }
    })

    // Process videos to add controls and responsive behavior
    const videos = tempDiv.querySelectorAll('video')
    videos.forEach((video) => {
      video.className = 'w-full rounded-lg shadow-sm'
      video.setAttribute('controls', 'true')
      video.setAttribute('preload', 'metadata')
    })

    // Process tables to add responsive styling
    const tables = tempDiv.querySelectorAll('table')
    tables.forEach((table) => {
      const wrapper = document.createElement('div')
      wrapper.className = 'overflow-x-auto my-6'
      table.className = 'min-w-full border-collapse border border-gray-300'
      table.parentNode?.insertBefore(wrapper, table)
      wrapper.appendChild(table)

      // Style table cells
      const cells = table.querySelectorAll('th, td')
      cells.forEach((cell) => {
        cell.className = 'border border-gray-300 px-4 py-2'
        if (cell.tagName === 'TH') {
          cell.className += ' bg-gray-50 font-semibold'
        }
      })
    })

    // Process blockquotes
    const blockquotes = tempDiv.querySelectorAll('blockquote')
    blockquotes.forEach((blockquote) => {
      blockquote.className = 'border-l-4 border-blue-500 pl-4 my-6 italic text-gray-700 bg-blue-50 py-4 rounded-r-lg'
    })

    return tempDiv.innerHTML
  }

  const renderCodeBlock = (codeId: string, language: string, code: string) => {
    const isCopied = copiedCode === codeId

    return (
      <div key={codeId} className="relative group my-6">
        <div className="flex items-center justify-between bg-gray-800 text-gray-200 px-4 py-2 rounded-t-lg">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium">{language}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(code, codeId)}
            className="h-8 text-gray-300 hover:text-white hover:bg-gray-700"
          >
            {isCopied ? (
              <>
                <Check className="h-4 w-4 mr-1" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-1" />
                Copy
              </>
            )}
          </Button>
        </div>
        <SyntaxHighlighter
          language={language}
          style={oneDark}
          customStyle={{
            margin: 0,
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            borderBottomLeftRadius: '0.5rem',
            borderBottomRightRadius: '0.5rem'
          }}
          showLineNumbers={code.split('\n').length > 5}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    )
  }

  // Convert markdown to HTML if needed, then process the content
  const htmlContent = convertMarkdownToHtml(content)
  const processedContent = processContent(htmlContent)

  return (
    <div className={`rich-content-container ${className}`}>
      {showTableOfContents && tocItems.length > 3 && (
        <Card className="mb-8">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Table of Contents
            </h3>
            <nav className="space-y-2">
              {tocItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToHeading(item.id)}
                  className={`block text-left w-full py-1 px-2 rounded hover:bg-gray-100 transition-colors ${
                    item.level === 1 ? 'font-semibold' :
                    item.level === 2 ? 'ml-4' :
                    item.level === 3 ? 'ml-8 text-sm' :
                    'ml-12 text-sm text-gray-600'
                  }`}
                >
                  {item.title}
                </button>
              ))}
            </nav>
          </CardContent>
        </Card>
      )}

      <div
        ref={contentRef}
        className="prose prose-lg max-w-none"
        dangerouslySetInnerHTML={{ __html: processedContent }}
      />

      {/* Render code blocks with syntax highlighting */}
      {contentRef.current &&
        Array.from(contentRef.current.querySelectorAll('.code-block-placeholder')).map((placeholder) => {
          const codeId = placeholder.getAttribute('data-code-block') || ''
          const language = placeholder.getAttribute('data-language') || 'text'
          const code = placeholder.getAttribute('data-code') || ''

          return renderCodeBlock(codeId, language, code)
        })
      }
    </div>
  )
}

// Enhanced image viewer component
export function ImageViewer({ src, alt, className = '' }: { src: string; alt?: string; className?: string }) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  return (
    <>
      <div className={`relative group ${className}`}>
        {isLoading && (
          <div className="absolute inset-0 bg-gray-200 animate-pulse rounded-lg flex items-center justify-center">
            <ImageIcon className="h-8 w-8 text-gray-400" />
          </div>
        )}

        <img
          src={src}
          alt={alt}
          className={`max-w-full h-auto rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer ${
            isLoading ? 'opacity-0' : 'opacity-100'
          }`}
          onClick={() => setIsModalOpen(true)}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false)
            setHasError(true)
          }}
          loading="lazy"
        />

        {hasError && (
          <div className="absolute inset-0 bg-gray-100 rounded-lg flex items-center justify-center">
            <div className="text-center text-gray-500">
              <ImageIcon className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">Failed to load image</p>
            </div>
          </div>
        )}

        {!isLoading && !hasError && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                setIsModalOpen(true)
              }}
            >
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Full-screen modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div className="relative max-w-screen-lg max-h-screen">
            <img
              src={src}
              alt={alt}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <Button
              variant="secondary"
              size="sm"
              className="absolute top-4 right-4"
              onClick={() => setIsModalOpen(false)}
            >
              ✕
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

// Video player component with custom controls
export function VideoPlayer({ src, poster, className = '' }: { src: string; poster?: string; className?: string }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const videoRef = useRef<HTMLVideoElement>(null)

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  return (
    <div className={`relative group ${className}`}>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full rounded-lg shadow-sm"
        controls
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      <div className="absolute bottom-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={togglePlay}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={toggleMute}
        >
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}