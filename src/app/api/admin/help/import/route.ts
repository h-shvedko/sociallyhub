import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/demo-user'

// POST /api/admin/help/import - Import articles from various formats
export async function POST(request: NextRequest) {
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

    const formData = await request.formData()
    const file = formData.get('file') as File
    const format = formData.get('format') as string
    const categoryId = formData.get('categoryId') as string
    const overwriteExisting = formData.get('overwriteExisting') === 'true'

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!format || !['json', 'markdown', 'html', 'csv'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Supported: json, markdown, html, csv' },
        { status: 400 }
      )
    }

    // Verify category exists if provided
    if (categoryId) {
      const category = await prisma.helpCategory.findUnique({
        where: { id: categoryId }
      })
      if (!category) {
        return NextResponse.json(
          { error: 'Category not found' },
          { status: 400 }
        )
      }
    }

    const fileContent = await file.text()
    let articles: any[] = []

    try {
      switch (format) {
        case 'json':
          articles = await parseJsonImport(fileContent)
          break
        case 'markdown':
          articles = await parseMarkdownImport(fileContent, file.name)
          break
        case 'html':
          articles = await parseHtmlImport(fileContent, file.name)
          break
        case 'csv':
          articles = await parseCsvImport(fileContent)
          break
        default:
          throw new Error('Unsupported format')
      }
    } catch (parseError) {
      return NextResponse.json(
        { error: `Failed to parse ${format} file: ${parseError.message}` },
        { status: 400 }
      )
    }

    if (articles.length === 0) {
      return NextResponse.json(
        { error: 'No valid articles found in file' },
        { status: 400 }
      )
    }

    // Process and import articles
    const results = {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[]
    }

    for (const articleData of articles) {
      try {
        // Validate required fields
        if (!articleData.title || !articleData.content) {
          results.errors.push(`Skipped article: Missing title or content`)
          results.skipped++
          continue
        }

        // Generate slug if not provided
        if (!articleData.slug) {
          articleData.slug = generateSlug(articleData.title)
        }

        // Use provided category or default
        const finalCategoryId = articleData.categoryId || categoryId

        if (!finalCategoryId) {
          results.errors.push(`Skipped article "${articleData.title}": No category specified`)
          results.skipped++
          continue
        }

        // Check if article already exists
        const existingArticle = await prisma.helpArticle.findFirst({
          where: {
            OR: [
              { slug: articleData.slug },
              { title: articleData.title }
            ]
          }
        })

        if (existingArticle && !overwriteExisting) {
          results.errors.push(`Skipped article "${articleData.title}": Already exists`)
          results.skipped++
          continue
        }

        const articlePayload = {
          title: articleData.title,
          slug: articleData.slug,
          content: articleData.content,
          excerpt: articleData.excerpt || generateExcerpt(articleData.content),
          categoryId: finalCategoryId,
          tags: Array.isArray(articleData.tags) ? articleData.tags : [],
          status: articleData.status || 'draft',
          seoTitle: articleData.seoTitle || articleData.title,
          seoDescription: articleData.seoDescription || articleData.excerpt || generateExcerpt(articleData.content),
          authorId: userId,
          publishedAt: articleData.status === 'published' ? new Date() : null,
          updatedAt: new Date()
        }

        if (existingArticle && overwriteExisting) {
          // Update existing article
          const updatedArticle = await prisma.helpArticle.update({
            where: { id: existingArticle.id },
            data: articlePayload
          })

          // Create revision for the update
          const lastRevision = await prisma.helpArticleRevision.findFirst({
            where: { articleId: existingArticle.id },
            orderBy: { version: 'desc' }
          })

          await prisma.helpArticleRevision.create({
            data: {
              articleId: existingArticle.id,
              version: (lastRevision?.version || 0) + 1,
              title: updatedArticle.title,
              content: updatedArticle.content,
              excerpt: updatedArticle.excerpt,
              categoryId: updatedArticle.categoryId,
              tags: updatedArticle.tags,
              status: updatedArticle.status,
              seoTitle: updatedArticle.seoTitle,
              seoDescription: updatedArticle.seoDescription,
              changeSummary: `Imported from ${format} file`,
              authorId: userId
            }
          })

          results.updated++
        } else {
          // Create new article
          const newArticle = await prisma.helpArticle.create({
            data: articlePayload
          })

          // Create initial revision
          await prisma.helpArticleRevision.create({
            data: {
              articleId: newArticle.id,
              version: 1,
              title: newArticle.title,
              content: newArticle.content,
              excerpt: newArticle.excerpt,
              categoryId: newArticle.categoryId,
              tags: newArticle.tags,
              status: newArticle.status,
              seoTitle: newArticle.seoTitle,
              seoDescription: newArticle.seoDescription,
              changeSummary: `Imported from ${format} file`,
              authorId: userId
            }
          })

          results.imported++
        }
      } catch (error) {
        results.errors.push(`Failed to import article "${articleData.title}": ${error.message}`)
        results.skipped++
      }
    }

    return NextResponse.json({
      message: 'Import completed',
      results,
      totalProcessed: articles.length
    })
  } catch (error) {
    console.error('Failed to import articles:', error)
    return NextResponse.json(
      { error: 'Failed to import articles' },
      { status: 500 }
    )
  }
}

// Helper functions for parsing different formats
async function parseJsonImport(content: string): Promise<any[]> {
  const data = JSON.parse(content)

  // Handle both single article and array of articles
  if (Array.isArray(data)) {
    return data
  } else if (data.articles && Array.isArray(data.articles)) {
    return data.articles
  } else if (data.title && data.content) {
    return [data]
  } else {
    throw new Error('Invalid JSON structure. Expected array of articles or single article object.')
  }
}

async function parseMarkdownImport(content: string, filename: string): Promise<any[]> {
  // Parse frontmatter and content
  const articles: any[] = []

  // Split by frontmatter delimiters (---) for multiple articles
  const sections = content.split(/^---\s*$/m)

  if (sections.length === 1) {
    // Single article without frontmatter
    articles.push({
      title: filename.replace(/\.md$/, '').replace(/-/g, ' '),
      content: content.trim(),
      slug: generateSlug(filename.replace(/\.md$/, ''))
    })
  } else {
    // Process sections with frontmatter
    for (let i = 1; i < sections.length; i += 2) {
      if (i + 1 >= sections.length) continue

      const frontmatter = sections[i].trim()
      const markdownContent = sections[i + 1].trim()

      const metadata: any = {}

      // Parse YAML-like frontmatter
      frontmatter.split('\n').forEach(line => {
        const match = line.match(/^(\w+):\s*(.+)$/)
        if (match) {
          const [, key, value] = match
          if (key === 'tags') {
            metadata[key] = value.split(',').map(tag => tag.trim())
          } else {
            metadata[key] = value.replace(/^["']|["']$/g, '')
          }
        }
      })

      articles.push({
        title: metadata.title || `Article ${i}`,
        content: markdownContent,
        slug: metadata.slug || generateSlug(metadata.title || `article-${i}`),
        excerpt: metadata.excerpt,
        tags: metadata.tags || [],
        status: metadata.status || 'draft',
        seoTitle: metadata.seoTitle,
        seoDescription: metadata.seoDescription
      })
    }
  }

  return articles
}

async function parseHtmlImport(content: string, filename: string): Promise<any[]> {
  // Simple HTML parsing - extract title and body content
  const titleMatch = content.match(/<title>(.*?)<\/title>/i)
  const h1Match = content.match(/<h1[^>]*>(.*?)<\/h1>/i)
  const bodyMatch = content.match(/<body[^>]*>(.*?)<\/body>/is)

  const title = titleMatch?.[1] || h1Match?.[1] || filename.replace(/\.html?$/, '').replace(/-/g, ' ')
  const bodyContent = bodyMatch?.[1] || content

  // Clean up HTML content
  const cleanContent = bodyContent
    .replace(/<script[^>]*>.*?<\/script>/gis, '')
    .replace(/<style[^>]*>.*?<\/style>/gis, '')
    .replace(/<!--.*?-->/gs, '')
    .trim()

  return [{
    title,
    content: cleanContent,
    slug: generateSlug(title)
  }]
}

async function parseCsvImport(content: string): Promise<any[]> {
  const lines = content.split('\n').map(line => line.trim()).filter(line => line)
  if (lines.length < 2) {
    throw new Error('CSV must have at least a header row and one data row')
  }

  const headers = lines[0].split(',').map(header => header.replace(/^"(.*)"$/, '$1').trim())
  const articles: any[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    if (values.length !== headers.length) continue

    const article: any = {}
    headers.forEach((header, index) => {
      const value = values[index]
      if (header === 'tags' && value) {
        article[header] = value.split(';').map(tag => tag.trim())
      } else {
        article[header] = value || null
      }
    })

    if (article.title && article.content) {
      articles.push(article)
    }
  }

  return articles
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function generateExcerpt(content: string, maxLength: number = 160): string {
  // Strip HTML tags and get plain text
  const plainText = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()

  if (plainText.length <= maxLength) {
    return plainText
  }

  // Find the last complete word within the limit
  const truncated = plainText.substring(0, maxLength)
  const lastSpace = truncated.lastIndexOf(' ')

  return lastSpace > 0 ? truncated.substring(0, lastSpace) + '...' : truncated + '...'
}