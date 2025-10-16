import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// GET /api/admin/help/export - Export articles in various formats
export async function GET(request: NextRequest) {
  try {
    // Check authentication and admin permissions
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = normalizeUserId(session.user.id)

    // Verify user has admin permissions
    const userWorkspaces = await prisma.userWorkspace.findMany({
      where: {
        userId,
        role: { in: ['OWNER', 'ADMIN'] }
      }
    })

    if (userWorkspaces.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'json'
    const status = searchParams.get('status')
    const categoryId = searchParams.get('categoryId')
    const articleIds = searchParams.get('articleIds')?.split(',')

    // Validate format
    if (!['json', 'markdown', 'html', 'csv'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Supported: json, markdown, html, csv' },
        { status: 400 }
      )
    }

    // Build query filters
    const where: any = {}

    if (status) {
      where.status = status
    }

    if (categoryId) {
      where.categoryId = categoryId
    }

    if (articleIds && articleIds.length > 0) {
      where.id = { in: articleIds }
    }

    // Fetch articles with related data
    const articles = await prisma.helpArticle.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        author: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    if (articles.length === 0) {
      return NextResponse.json(
        { error: 'No articles found matching the criteria' },
        { status: 404 }
      )
    }

    // Generate export content based on format
    let content: string
    let contentType: string
    let filename: string

    switch (format) {
      case 'json':
        content = generateJsonExport(articles)
        contentType = 'application/json'
        filename = `help-articles-${new Date().toISOString().split('T')[0]}.json`
        break

      case 'markdown':
        content = generateMarkdownExport(articles)
        contentType = 'text/markdown'
        filename = `help-articles-${new Date().toISOString().split('T')[0]}.md`
        break

      case 'html':
        content = generateHtmlExport(articles)
        contentType = 'text/html'
        filename = `help-articles-${new Date().toISOString().split('T')[0]}.html`
        break

      case 'csv':
        content = generateCsvExport(articles)
        contentType = 'text/csv'
        filename = `help-articles-${new Date().toISOString().split('T')[0]}.csv`
        break

      default:
        return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
    }

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
  } catch (error) {
    console.error('Failed to export articles:', error)
    return NextResponse.json(
      { error: 'Failed to export articles' },
      { status: 500 }
    )
  }
}

function generateJsonExport(articles: any[]): string {
  const exportData = {
    exportedAt: new Date().toISOString(),
    totalArticles: articles.length,
    format: 'SociallyHub Help Articles JSON Export v1.0',
    articles: articles.map(article => ({
      id: article.id,
      title: article.title,
      slug: article.slug,
      content: article.content,
      excerpt: article.excerpt,
      status: article.status,
      categoryId: article.categoryId,
      categoryName: article.category.name,
      tags: article.tags,
      seoTitle: article.seoTitle,
      seoDescription: article.seoDescription,
      authorId: article.authorId,
      authorName: article.author.name,
      authorEmail: article.author.email,
      createdAt: article.createdAt.toISOString(),
      updatedAt: article.updatedAt.toISOString(),
      publishedAt: article.publishedAt?.toISOString() || null
    }))
  }

  return JSON.stringify(exportData, null, 2)
}

function generateMarkdownExport(articles: any[]): string {
  let content = `# Help Articles Export\n\n`
  content += `Exported on: ${new Date().toLocaleDateString()}\n`
  content += `Total articles: ${articles.length}\n\n`
  content += `---\n\n`

  articles.forEach(article => {
    content += `---\n`
    content += `title: "${article.title}"\n`
    content += `slug: "${article.slug}"\n`
    content += `status: "${article.status}"\n`
    content += `category: "${article.category.name}"\n`
    content += `tags: ${article.tags.map((tag: string) => `"${tag}"`).join(', ')}\n`
    if (article.excerpt) {
      content += `excerpt: "${article.excerpt}"\n`
    }
    if (article.seoTitle) {
      content += `seoTitle: "${article.seoTitle}"\n`
    }
    if (article.seoDescription) {
      content += `seoDescription: "${article.seoDescription}"\n`
    }
    content += `author: "${article.author.name}"\n`
    content += `createdAt: "${article.createdAt.toISOString()}"\n`
    content += `updatedAt: "${article.updatedAt.toISOString()}"\n`
    if (article.publishedAt) {
      content += `publishedAt: "${article.publishedAt.toISOString()}"\n`
    }
    content += `---\n\n`
    content += `${article.content}\n\n`
    content += `---\n\n`
  })

  return content
}

function generateHtmlExport(articles: any[]): string {
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Help Articles Export</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; line-height: 1.6; }
        .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
        .article { border: 1px solid #ddd; margin-bottom: 30px; padding: 20px; border-radius: 5px; }
        .article-header { border-bottom: 1px solid #eee; padding-bottom: 15px; margin-bottom: 20px; }
        .article-title { color: #333; margin: 0 0 10px 0; }
        .article-meta { color: #666; font-size: 0.9em; }
        .article-meta span { margin-right: 15px; }
        .article-content { margin-top: 20px; }
        .tag { background: #f0f0f0; padding: 2px 8px; border-radius: 3px; font-size: 0.8em; margin-right: 5px; }
        .status { padding: 2px 8px; border-radius: 3px; font-size: 0.8em; font-weight: bold; }
        .status.published { background: #d4edda; color: #155724; }
        .status.draft { background: #fff3cd; color: #856404; }
        .status.archived { background: #f8d7da; color: #721c24; }
        @media print { body { padding: 0; } .article { page-break-inside: avoid; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>Help Articles Export</h1>
        <p>Exported on: ${new Date().toLocaleDateString()} | Total articles: ${articles.length}</p>
    </div>
`

  articles.forEach(article => {
    html += `
    <article class="article">
        <div class="article-header">
            <h2 class="article-title">${escapeHtml(article.title)}</h2>
            <div class="article-meta">
                <span><strong>Category:</strong> ${escapeHtml(article.category.name)}</span>
                <span><strong>Status:</strong> <span class="status ${article.status}">${article.status}</span></span>
                <span><strong>Author:</strong> ${escapeHtml(article.author.name)}</span>
                <span><strong>Created:</strong> ${new Date(article.createdAt).toLocaleDateString()}</span>
                ${article.publishedAt ? `<span><strong>Published:</strong> ${new Date(article.publishedAt).toLocaleDateString()}</span>` : ''}
            </div>
            ${article.tags.length > 0 ? `
            <div style="margin-top: 10px;">
                <strong>Tags:</strong> ${article.tags.map((tag: string) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
            </div>
            ` : ''}
            ${article.excerpt ? `
            <div style="margin-top: 10px;">
                <strong>Excerpt:</strong> ${escapeHtml(article.excerpt)}
            </div>
            ` : ''}
        </div>
        <div class="article-content">
            ${article.content}
        </div>
    </article>
`
  })

  html += `
    <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 0.9em;">
        <p>Generated by SociallyHub Help Articles Management System</p>
    </div>
</body>
</html>`

  return html
}

function generateCsvExport(articles: any[]): string {
  const headers = [
    'ID',
    'Title',
    'Slug',
    'Content',
    'Excerpt',
    'Status',
    'Category ID',
    'Category Name',
    'Tags',
    'SEO Title',
    'SEO Description',
    'Author ID',
    'Author Name',
    'Author Email',
    'Created At',
    'Updated At',
    'Published At'
  ]

  const csvContent = [
    headers.join(','),
    ...articles.map(article => [
      escapeCsv(article.id),
      escapeCsv(article.title),
      escapeCsv(article.slug),
      escapeCsv(article.content),
      escapeCsv(article.excerpt || ''),
      escapeCsv(article.status),
      escapeCsv(article.categoryId),
      escapeCsv(article.category.name),
      escapeCsv(article.tags.join(';')),
      escapeCsv(article.seoTitle || ''),
      escapeCsv(article.seoDescription || ''),
      escapeCsv(article.authorId),
      escapeCsv(article.author.name),
      escapeCsv(article.author.email),
      escapeCsv(article.createdAt.toISOString()),
      escapeCsv(article.updatedAt.toISOString()),
      escapeCsv(article.publishedAt?.toISOString() || '')
    ].join(','))
  ]

  return csvContent.join('\n')
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function escapeCsv(text: string): string {
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}