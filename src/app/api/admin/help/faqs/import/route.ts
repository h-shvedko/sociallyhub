import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = normalizeUserId(session.user.id)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { workspaces: true }
    })

    if (!user?.workspaces?.[0]) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 403 })
    }

    const body = await request.json()
    const { format, content, options = {} } = body

    if (!format || !content) {
      return NextResponse.json(
        { error: 'Format and content are required' },
        { status: 400 }
      )
    }

    let faqsToImport: any[] = []
    const results = {
      imported: 0,
      failed: 0,
      errors: [] as string[],
      faqs: [] as Array<{ question: string; status: string; error?: string }>
    }

    try {
      // Parse content based on format
      if (format === 'json') {
        const parsed = JSON.parse(content)
        faqsToImport = Array.isArray(parsed) ? parsed : [parsed]
      } else if (format === 'csv') {
        const lines = content.trim().split('\n')
        const headers = lines[0].split(',').map((h: string) => h.trim().replace(/"/g, ''))

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map((v: string) => v.trim().replace(/"/g, ''))
          const faq: any = {}

          headers.forEach((header: string, index: number) => {
            if (values[index]) {
              if (header === 'tags') {
                faq[header] = values[index].split(';').map((t: string) => t.trim())
              } else if (header === 'isActive' || header === 'isPinned') {
                faq[header] = values[index].toLowerCase() === 'true'
              } else if (header === 'sortOrder') {
                faq[header] = parseInt(values[index]) || 0
              } else {
                faq[header] = values[index]
              }
            }
          })

          if (faq.question && faq.answer) {
            faqsToImport.push(faq)
          }
        }
      } else {
        return NextResponse.json(
          { error: 'Unsupported format. Use json or csv.' },
          { status: 400 }
        )
      }

      // Get all categories for mapping
      const categories = await prisma.helpCategory.findMany({
        select: { id: true, name: true, slug: true }
      })

      const categoryMap = new Map()
      categories.forEach(cat => {
        categoryMap.set(cat.name.toLowerCase(), cat.id)
        categoryMap.set(cat.slug.toLowerCase(), cat.id)
        categoryMap.set(cat.id, cat.id)
      })

      // Process each FAQ
      for (const faqData of faqsToImport) {
        try {
          // Validate required fields
          if (!faqData.question || !faqData.answer) {
            results.failed++
            results.errors.push(`FAQ missing question or answer: ${faqData.question || 'Unknown'}`)
            results.faqs.push({
              question: faqData.question || 'Unknown',
              status: 'failed',
              error: 'Missing question or answer'
            })
            continue
          }

          // Map category
          let categoryId = faqData.categoryId
          if (faqData.category) {
            const mappedCategoryId = categoryMap.get(faqData.category.toLowerCase())
            if (mappedCategoryId) {
              categoryId = mappedCategoryId
            } else if (options.createMissingCategories) {
              // Create new category
              const newCategory = await prisma.helpCategory.create({
                data: {
                  name: faqData.category,
                  slug: faqData.category.toLowerCase().replace(/\s+/g, '-'),
                  description: `Auto-created category for ${faqData.category}`,
                  sortOrder: 999
                }
              })
              categoryId = newCategory.id
              categoryMap.set(faqData.category.toLowerCase(), newCategory.id)
            }
          }

          if (!categoryId) {
            // Use default category (first available)
            categoryId = categories[0]?.id
          }

          if (!categoryId) {
            results.failed++
            results.errors.push(`No valid category found for FAQ: ${faqData.question}`)
            results.faqs.push({
              question: faqData.question,
              status: 'failed',
              error: 'No valid category'
            })
            continue
          }

          // Check for existing FAQ if not overwriting
          if (!options.overwriteExisting) {
            const existing = await prisma.helpFAQ.findFirst({
              where: {
                question: faqData.question,
                categoryId
              }
            })

            if (existing) {
              results.failed++
              results.errors.push(`FAQ already exists: ${faqData.question}`)
              results.faqs.push({
                question: faqData.question,
                status: 'failed',
                error: 'Already exists'
              })
              continue
            }
          }

          // Get next sort order if not specified
          let sortOrder = parseInt(faqData.sortOrder) || 0
          if (sortOrder === 0) {
            const lastFaq = await prisma.helpFAQ.findFirst({
              where: { categoryId },
              orderBy: { sortOrder: 'desc' }
            })
            sortOrder = (lastFaq?.sortOrder || 0) + 1
          }

          // Create or update FAQ
          const faqCreateData = {
            question: faqData.question,
            answer: faqData.answer,
            categoryId,
            sortOrder,
            isActive: faqData.isActive !== undefined ? faqData.isActive : true,
            isPinned: faqData.isPinned !== undefined ? faqData.isPinned : false,
            tags: Array.isArray(faqData.tags) ? faqData.tags : [],
            views: parseInt(faqData.views) || 0,
            helpfulVotes: parseInt(faqData.helpfulVotes) || 0,
            notHelpfulVotes: parseInt(faqData.notHelpfulVotes) || 0
          }

          if (options.overwriteExisting) {
            await prisma.helpFAQ.upsert({
              where: {
                question_categoryId: {
                  question: faqData.question,
                  categoryId
                }
              },
              create: faqCreateData,
              update: faqCreateData
            })
          } else {
            await prisma.helpFAQ.create({
              data: faqCreateData
            })
          }

          results.imported++
          results.faqs.push({
            question: faqData.question,
            status: 'imported'
          })

        } catch (error) {
          results.failed++
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          results.errors.push(`Failed to import FAQ "${faqData.question}": ${errorMessage}`)
          results.faqs.push({
            question: faqData.question || 'Unknown',
            status: 'failed',
            error: errorMessage
          })
        }
      }

    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid content format: ' + (parseError instanceof Error ? parseError.message : 'Unknown error') },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: results.imported > 0,
      message: `Import completed. ${results.imported} imported, ${results.failed} failed.`,
      ...results
    })

  } catch (error) {
    console.error('Error importing FAQs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}