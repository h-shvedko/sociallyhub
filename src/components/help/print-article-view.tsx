'use client'

import { useEffect } from 'react'

interface HelpArticle {
  id: string
  title: string
  content: string
  excerpt?: string
  category: {
    name: string
  }
  author?: {
    name: string
  }
  publishedAt?: string
  readingTime?: number
  views: number
  helpfulVotes: number
}

interface PrintArticleViewProps {
  article: HelpArticle
}

export function PrintArticleView({ article }: PrintArticleViewProps) {
  useEffect(() => {
    // Add print-specific styles
    const printStyles = document.createElement('style')
    printStyles.textContent = `
      @media print {
        body * {
          visibility: hidden;
        }

        .print-container,
        .print-container * {
          visibility: visible;
        }

        .print-container {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          background: white;
        }

        .print-header {
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 1rem;
          margin-bottom: 2rem;
        }

        .print-title {
          font-size: 2rem;
          font-weight: bold;
          color: #111827;
          margin-bottom: 0.5rem;
        }

        .print-meta {
          font-size: 0.875rem;
          color: #6b7280;
          margin-bottom: 1rem;
        }

        .print-content {
          font-size: 1rem;
          line-height: 1.6;
          color: #374151;
          max-width: none;
        }

        .print-content h1,
        .print-content h2,
        .print-content h3,
        .print-content h4,
        .print-content h5,
        .print-content h6 {
          color: #111827;
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
          font-weight: 600;
        }

        .print-content h1 { font-size: 1.875rem; }
        .print-content h2 { font-size: 1.5rem; }
        .print-content h3 { font-size: 1.25rem; }
        .print-content h4 { font-size: 1.125rem; }

        .print-content p {
          margin-bottom: 1rem;
        }

        .print-content ul,
        .print-content ol {
          margin-bottom: 1rem;
          padding-left: 1.5rem;
        }

        .print-content li {
          margin-bottom: 0.25rem;
        }

        .print-content code {
          background-color: #f3f4f6;
          padding: 0.125rem 0.25rem;
          border-radius: 0.25rem;
          font-family: 'Courier New', monospace;
          font-size: 0.875rem;
        }

        .print-content pre {
          background-color: #f3f4f6;
          padding: 1rem;
          border-radius: 0.375rem;
          overflow-x: visible;
          margin-bottom: 1rem;
        }

        .print-content blockquote {
          border-left: 4px solid #e5e7eb;
          padding-left: 1rem;
          margin: 1rem 0;
          font-style: italic;
          color: #6b7280;
        }

        .print-footer {
          margin-top: 3rem;
          padding-top: 1rem;
          border-top: 1px solid #e5e7eb;
          font-size: 0.875rem;
          color: #6b7280;
          text-align: center;
        }

        .print-logo {
          font-weight: bold;
          color: #3b82f6;
        }

        /* Hide buttons and interactive elements */
        .no-print {
          display: none !important;
        }

        /* Page breaks */
        .page-break {
          page-break-before: always;
        }

        /* Avoid breaking headings */
        h1, h2, h3, h4, h5, h6 {
          page-break-after: avoid;
        }

        /* Keep list items together */
        li {
          page-break-inside: avoid;
        }
      }
    `

    document.head.appendChild(printStyles)

    return () => {
      document.head.removeChild(printStyles)
    }
  }, [])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="print-container bg-white text-black p-8 max-w-none">
      {/* Print Header */}
      <div className="print-header">
        <h1 className="print-title">{article.title}</h1>

        <div className="print-meta flex flex-wrap gap-6">
          <span>Category: {article.category.name}</span>

          {article.author && (
            <span>By: {article.author.name}</span>
          )}

          {article.publishedAt && (
            <span>Published: {formatDate(article.publishedAt)}</span>
          )}

          {article.readingTime && (
            <span>Reading Time: {article.readingTime} min</span>
          )}

          <span>Views: {article.views.toLocaleString()}</span>
          <span>Helpful Votes: {article.helpfulVotes}</span>
        </div>

        {article.excerpt && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border-l-4 border-blue-500">
            <p className="text-gray-700 italic">{article.excerpt}</p>
          </div>
        )}
      </div>

      {/* Article Content */}
      <div
        className="print-content prose max-w-none"
        dangerouslySetInnerHTML={{ __html: article.content }}
      />

      {/* Print Footer */}
      <div className="print-footer">
        <div className="flex justify-between items-center">
          <div>
            <span className="print-logo">SociallyHub</span> Help Center
          </div>
          <div>
            Printed on {new Date().toLocaleDateString()}
          </div>
        </div>
        <div className="mt-2 text-xs">
          For the latest version of this article, visit our Help Center online.
        </div>
      </div>
    </div>
  )
}

// Hook to trigger print
export function usePrintArticle() {
  return {
    printArticle: () => {
      // Small delay to ensure styles are applied
      setTimeout(() => {
        window.print()
      }, 100)
    }
  }
}