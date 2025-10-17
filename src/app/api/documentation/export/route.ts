import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/utils'

// POST /api/documentation/export - Export documentation in various formats
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const body = await request.json()
    const {
      pageIds = [],
      sectionId,
      format = 'PDF',
      options = {}
    } = body

    // If no specific pages, export entire section or all pages
    let pages: any[] = []

    if (pageIds.length > 0) {
      // Export specific pages
      pages = await prisma.documentationPage.findMany({
        where: {
          id: { in: pageIds },
          status: 'PUBLISHED'
        },
        include: {
          section: true,
          author: {
            select: {
              name: true,
              email: true
            }
          },
          codeExamples: {
            orderBy: { sortOrder: 'asc' }
          }
        },
        orderBy: { sortOrder: 'asc' }
      })
    } else if (sectionId) {
      // Export entire section
      pages = await prisma.documentationPage.findMany({
        where: {
          sectionId,
          status: 'PUBLISHED'
        },
        include: {
          section: true,
          author: {
            select: {
              name: true,
              email: true
            }
          },
          codeExamples: {
            orderBy: { sortOrder: 'asc' }
          }
        },
        orderBy: { sortOrder: 'asc' }
      })
    } else {
      // Export all published pages
      pages = await prisma.documentationPage.findMany({
        where: {
          status: 'PUBLISHED'
        },
        include: {
          section: true,
          author: {
            select: {
              name: true,
              email: true
            }
          },
          codeExamples: {
            orderBy: { sortOrder: 'asc' }
          }
        },
        orderBy: [
          { section: { sortOrder: 'asc' } },
          { sortOrder: 'asc' }
        ]
      })
    }

    if (pages.length === 0) {
      return NextResponse.json(
        { error: 'No pages found to export' },
        { status: 404 }
      )
    }

    // Generate export based on format
    let exportData: any
    let contentType: string
    let filename: string

    switch (format.toUpperCase()) {
      case 'PDF':
        exportData = generatePDFExport(pages, options)
        contentType = 'text/html'
        filename = 'documentation.html' // HTML that can be printed to PDF
        break

      case 'MARKDOWN':
        exportData = generateMarkdownExport(pages, options)
        contentType = 'text/markdown'
        filename = 'documentation.md'
        break

      case 'HTML':
        exportData = generateHTMLExport(pages, options)
        contentType = 'text/html'
        filename = 'documentation.html'
        break

      case 'CONFLUENCE':
        exportData = generateConfluenceExport(pages, options)
        contentType = 'application/json'
        filename = 'documentation-confluence.json'
        break

      case 'NOTION':
        exportData = generateNotionExport(pages, options)
        contentType = 'application/json'
        filename = 'documentation-notion.json'
        break

      case 'DOCX':
        exportData = generateDocxExport(pages, options)
        contentType = 'text/html'
        filename = 'documentation-docx.html'
        break

      default:
        return NextResponse.json(
          { error: 'Unsupported export format' },
          { status: 400 }
        )
    }

    // Create export record
    const exportRecord = await prisma.documentationExport.create({
      data: {
        format: format.toUpperCase() as any,
        pageCount: pages.length,
        metadata: {
          pageIds: pages.map(p => p.id),
          options,
          exportedAt: new Date().toISOString()
        },
        createdById: normalizedUserId
      }
    })

    // Return the export data
    return new NextResponse(exportData, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Export-Id': exportRecord.id,
        'X-Page-Count': pages.length.toString()
      }
    })
  } catch (error) {
    console.error('Failed to export documentation:', error)
    return NextResponse.json(
      { error: 'Failed to export documentation' },
      { status: 500 }
    )
  }
}

// GET /api/documentation/export - Get export history
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    const exports = await prisma.documentationExport.findMany({
      where: {
        createdById: normalizedUserId
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })

    const totalCount = await prisma.documentationExport.count({
      where: {
        createdById: normalizedUserId
      }
    })

    return NextResponse.json({
      exports,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    })
  } catch (error) {
    console.error('Failed to fetch export history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch export history' },
      { status: 500 }
    )
  }
}

function generatePDFExport(pages: any[], options: any): string {
  const { includeTableOfContents = true, includeCodeExamples = true, includeMetadata = true } = options

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Documentation Export</title>
  <style>
    @media print {
      .page-break { page-break-after: always; }
      .no-print { display: none; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
    h2 { color: #34495e; margin-top: 30px; }
    h3 { color: #7f8c8d; }
    pre {
      background: #f4f4f4;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 10px;
      overflow-x: auto;
    }
    code {
      background: #f4f4f4;
      padding: 2px 4px;
      border-radius: 3px;
      font-family: 'Courier New', Courier, monospace;
    }
    .metadata {
      background: #ecf0f1;
      padding: 10px;
      border-radius: 4px;
      margin-bottom: 20px;
      font-size: 0.9em;
    }
    .toc {
      background: #f9f9f9;
      border: 1px solid #ddd;
      padding: 20px;
      border-radius: 4px;
      margin-bottom: 30px;
    }
    .toc ul {
      list-style: none;
      padding-left: 20px;
    }
    .toc a {
      color: #3498db;
      text-decoration: none;
    }
    .toc a:hover {
      text-decoration: underline;
    }
    .code-example {
      margin: 20px 0;
      border-left: 4px solid #3498db;
      padding-left: 15px;
    }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      text-align: center;
      color: #7f8c8d;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <div class="cover">
    <h1>Documentation Export</h1>
    <p>Generated on ${new Date().toLocaleDateString()}</p>
    <p>Total Pages: ${pages.length}</p>
  </div>
`

  // Add table of contents
  if (includeTableOfContents) {
    html += `
  <div class="toc page-break">
    <h2>Table of Contents</h2>
    <ul>
`
    // Group pages by section
    const sections = pages.reduce((acc, page) => {
      const sectionTitle = page.section.title
      if (!acc[sectionTitle]) {
        acc[sectionTitle] = []
      }
      acc[sectionTitle].push(page)
      return acc
    }, {} as Record<string, any[]>)

    Object.entries(sections).forEach(([sectionTitle, sectionPages]) => {
      html += `      <li>
        <strong>${sectionTitle}</strong>
        <ul>
`
      sectionPages.forEach(page => {
        html += `          <li><a href="#${page.slug}">${page.title}</a></li>
`
      })
      html += `        </ul>
      </li>
`
    })

    html += `    </ul>
  </div>
`
  }

  // Add pages content
  pages.forEach((page, index) => {
    html += `
  <div class="page ${index < pages.length - 1 ? 'page-break' : ''}">
    <h1 id="${page.slug}">${page.title}</h1>
`

    if (includeMetadata) {
      html += `
    <div class="metadata">
      <strong>Section:</strong> ${page.section.title} |
      <strong>Author:</strong> ${page.author.name} |
      <strong>Last Updated:</strong> ${new Date(page.updatedAt).toLocaleDateString()}
    </div>
`
    }

    // Convert content (basic markdown to HTML conversion)
    let content = page.content
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>')

    html += content

    // Add code examples
    if (includeCodeExamples && page.codeExamples && page.codeExamples.length > 0) {
      html += `
    <h2>Code Examples</h2>
`
      page.codeExamples.forEach((example: any) => {
        html += `
    <div class="code-example">
      <h3>${example.title}</h3>
`
        if (example.description) {
          html += `      <p>${example.description}</p>
`
        }
        html += `      <pre><code class="language-${example.language.toLowerCase()}">${escapeHtml(example.code)}</code></pre>
    </div>
`
      })
    }

    html += `
  </div>
`
  })

  // Add footer
  html += `
  <div class="footer no-print">
    <p>Documentation exported from SociallyHub</p>
    <p>${new Date().toISOString()}</p>
  </div>
</body>
</html>`

  return html
}

function generateMarkdownExport(pages: any[], options: any): string {
  const { includeTableOfContents = true, includeCodeExamples = true, includeMetadata = true } = options

  let markdown = `# Documentation Export

Generated on ${new Date().toLocaleDateString()}

Total Pages: ${pages.length}

---

`

  // Add table of contents
  if (includeTableOfContents) {
    markdown += `## Table of Contents

`
    // Group pages by section
    const sections = pages.reduce((acc, page) => {
      const sectionTitle = page.section.title
      if (!acc[sectionTitle]) {
        acc[sectionTitle] = []
      }
      acc[sectionTitle].push(page)
      return acc
    }, {} as Record<string, any[]>)

    Object.entries(sections).forEach(([sectionTitle, sectionPages]) => {
      markdown += `### ${sectionTitle}

`
      sectionPages.forEach(page => {
        markdown += `- [${page.title}](#${page.slug.replace(/[^a-z0-9-]/g, '')})\n`
      })
      markdown += `
`
    })

    markdown += `---

`
  }

  // Add pages content
  pages.forEach(page => {
    markdown += `## ${page.title}

`

    if (includeMetadata) {
      markdown += `> **Section:** ${page.section.title}
> **Author:** ${page.author.name}
> **Last Updated:** ${new Date(page.updatedAt).toLocaleDateString()}

`
    }

    markdown += page.content + `

`

    // Add code examples
    if (includeCodeExamples && page.codeExamples && page.codeExamples.length > 0) {
      markdown += `### Code Examples

`
      page.codeExamples.forEach((example: any) => {
        markdown += `#### ${example.title}

`
        if (example.description) {
          markdown += `${example.description}

`
        }
        markdown += `\`\`\`${example.language.toLowerCase()}
${example.code}
\`\`\`

`
      })
    }

    markdown += `---

`
  })

  markdown += `
*Documentation exported from SociallyHub on ${new Date().toISOString()}*`

  return markdown
}

function generateHTMLExport(pages: any[], options: any): string {
  // Similar to PDF export but with different styling and no print-specific CSS
  return generatePDFExport(pages, { ...options, forWeb: true })
}

function generateConfluenceExport(pages: any[], options: any): string {
  // Generate Confluence-compatible JSON format
  const confluenceData = {
    version: 1,
    type: 'page',
    title: 'Documentation Export',
    space: { key: options.spaceKey || 'DOCS' },
    body: {
      storage: {
        value: pages.map(page => ({
          title: page.title,
          content: page.content,
          metadata: {
            section: page.section.title,
            author: page.author.name,
            updatedAt: page.updatedAt
          }
        })),
        representation: 'storage'
      }
    }
  }

  return JSON.stringify(confluenceData, null, 2)
}

function generateNotionExport(pages: any[], options: any): string {
  // Generate Notion-compatible JSON format
  const notionData = {
    pages: pages.map(page => ({
      object: 'page',
      properties: {
        title: {
          title: [{
            text: { content: page.title }
          }]
        },
        section: {
          select: { name: page.section.title }
        },
        author: {
          people: [{ name: page.author.name }]
        },
        lastEdited: {
          date: { start: page.updatedAt }
        }
      },
      children: [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            text: [{
              type: 'text',
              text: { content: page.content }
            }]
          }
        },
        ...(page.codeExamples || []).map((example: any) => ({
          object: 'block',
          type: 'code',
          code: {
            caption: [{ text: { content: example.title } }],
            language: example.language.toLowerCase(),
            text: [{
              text: { content: example.code }
            }]
          }
        }))
      ]
    }))
  }

  return JSON.stringify(notionData, null, 2)
}

function generateDocxExport(pages: any[], options: any): string {
  // Generate HTML that can be easily converted to DOCX
  // In a real implementation, you would use a library like docx or pandoc
  return generatePDFExport(pages, { ...options, forDocx: true })
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }
  return text.replace(/[&<>"']/g, m => map[m])
}