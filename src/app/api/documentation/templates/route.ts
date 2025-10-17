import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/utils'

// GET /api/documentation/templates - Get documentation templates
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type')
    const category = searchParams.get('category')

    const where: any = { isActive: true }

    if (type) {
      where.type = type.toUpperCase()
    }

    if (category) {
      where.category = category.toUpperCase()
    }

    const templates = await prisma.documentationTemplate.findMany({
      where,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        _count: {
          select: {
            pages: true
          }
        }
      },
      orderBy: [
        { isDefault: 'desc' },
        { usageCount: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    return NextResponse.json(templates)
  } catch (error) {
    console.error('Failed to fetch documentation templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch documentation templates' },
      { status: 500 }
    )
  }
}

// POST /api/documentation/templates - Create new documentation template
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const body = await request.json()
    const {
      name,
      description,
      type = 'PAGE',
      category = 'GENERAL',
      content,
      structure,
      placeholders = [],
      metadata = {},
      isDefault = false,
      tags = []
    } = body

    if (!name || !content) {
      return NextResponse.json(
        { error: 'Name and content are required' },
        { status: 400 }
      )
    }

    // If setting as default, unset other defaults in the same category
    if (isDefault) {
      await prisma.documentationTemplate.updateMany({
        where: {
          category: category.toUpperCase(),
          isDefault: true
        },
        data: {
          isDefault: false
        }
      })
    }

    const template = await prisma.documentationTemplate.create({
      data: {
        name,
        description,
        type: type.toUpperCase() as any,
        category: category.toUpperCase() as any,
        content,
        structure,
        placeholders,
        metadata,
        isDefault,
        tags,
        authorId: normalizedUserId
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    console.error('Failed to create documentation template:', error)
    return NextResponse.json(
      { error: 'Failed to create documentation template' },
      { status: 500 }
    )
  }
}

// PUT /api/documentation/templates/[id] - Update documentation template
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const id = pathParts[pathParts.length - 1]

    const body = await request.json()
    const {
      name,
      description,
      type,
      category,
      content,
      structure,
      placeholders,
      metadata,
      isDefault,
      tags
    } = body

    // Check if template exists
    const existingTemplate = await prisma.documentationTemplate.findUnique({
      where: { id }
    })

    if (!existingTemplate) {
      return NextResponse.json(
        { error: 'Documentation template not found' },
        { status: 404 }
      )
    }

    // If setting as default, unset other defaults in the same category
    if (isDefault && category) {
      await prisma.documentationTemplate.updateMany({
        where: {
          category: category.toUpperCase(),
          isDefault: true,
          id: { not: id }
        },
        data: {
          isDefault: false
        }
      })
    }

    const updatedTemplate = await prisma.documentationTemplate.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(type && { type: type.toUpperCase() as any }),
        ...(category && { category: category.toUpperCase() as any }),
        ...(content && { content }),
        ...(structure && { structure }),
        ...(placeholders && { placeholders }),
        ...(metadata && { metadata }),
        ...(isDefault !== undefined && { isDefault }),
        ...(tags && { tags })
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    return NextResponse.json(updatedTemplate)
  } catch (error) {
    console.error('Failed to update documentation template:', error)
    return NextResponse.json(
      { error: 'Failed to update documentation template' },
      { status: 500 }
    )
  }
}

// DELETE /api/documentation/templates/[id] - Delete documentation template
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const id = pathParts[pathParts.length - 1]

    // Check if template exists
    const existingTemplate = await prisma.documentationTemplate.findUnique({
      where: { id }
    })

    if (!existingTemplate) {
      return NextResponse.json(
        { error: 'Documentation template not found' },
        { status: 404 }
      )
    }

    // Don't allow deletion of default templates that are in use
    if (existingTemplate.isDefault) {
      const usageCount = await prisma.documentationPage.count({
        where: { templateId: id }
      })

      if (usageCount > 0) {
        return NextResponse.json(
          { error: 'Cannot delete default template that is in use' },
          { status: 400 }
        )
      }
    }

    await prisma.documentationTemplate.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete documentation template:', error)
    return NextResponse.json(
      { error: 'Failed to delete documentation template' },
      { status: 500 }
    )
  }
}

// POST /api/documentation/templates/[id]/use - Use template to create new page
export async function POST(request: NextRequest) {
  if (request.url.includes('/use')) {
    try {
      const session = await getServerSession(authOptions)
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const normalizedUserId = normalizeUserId(session.user.id)
      const url = new URL(request.url)
      const pathParts = url.pathname.split('/')
      const templateId = pathParts[pathParts.length - 2] // Get template ID from URL

      const body = await request.json()
      const { variables = {}, sectionId, title, slug } = body

      // Get template
      const template = await prisma.documentationTemplate.findUnique({
        where: { id: templateId }
      })

      if (!template) {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        )
      }

      // Process template content with variables
      let processedContent = template.content
      let processedTitle = title || template.name

      // Replace placeholders with variables
      template.placeholders?.forEach((placeholder: any) => {
        const value = variables[placeholder.key] || placeholder.defaultValue || `[${placeholder.key}]`
        const regex = new RegExp(`{{${placeholder.key}}}`, 'g')
        processedContent = processedContent.replace(regex, value)
        processedTitle = processedTitle.replace(regex, value)
      })

      // Generate slug if not provided
      const finalSlug = slug || processedTitle.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')

      // Check if slug already exists
      const existingPage = await prisma.documentationPage.findUnique({
        where: { slug: finalSlug }
      })

      if (existingPage) {
        return NextResponse.json(
          { error: 'Page with this slug already exists' },
          { status: 409 }
        )
      }

      // Create page from template
      const page = await prisma.documentationPage.create({
        data: {
          title: processedTitle,
          slug: finalSlug,
          content: processedContent,
          excerpt: template.description,
          sectionId: sectionId || '',
          tags: template.tags || [],
          status: 'DRAFT',
          visibility: 'INTERNAL',
          authorId: normalizedUserId,
          templateId,
          metadata: {
            ...template.metadata,
            createdFromTemplate: true,
            templateVariables: variables
          }
        },
        include: {
          section: true,
          author: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })

      // Increment template usage count
      await prisma.documentationTemplate.update({
        where: { id: templateId },
        data: {
          usageCount: {
            increment: 1
          }
        }
      })

      return NextResponse.json(page, { status: 201 })
    } catch (error) {
      console.error('Failed to use template:', error)
      return NextResponse.json(
        { error: 'Failed to use template' },
        { status: 500 }
      )
    }
  }
}

// POST /api/documentation/templates/seed - Seed default templates
export async function POST(request: NextRequest) {
  if (request.url.includes('/seed')) {
    try {
      const session = await getServerSession(authOptions)
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const normalizedUserId = normalizeUserId(session.user.id)

      const defaultTemplates = [
        {
          name: 'API Endpoint Documentation',
          description: 'Template for documenting API endpoints',
          type: 'PAGE',
          category: 'API',
          content: `# {{endpoint_name}}

## Description
{{description}}

## Endpoint
\`{{method}} {{path}}\`

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
{{#each parameters}}
| {{name}} | {{type}} | {{required}} | {{description}} |
{{/each}}

## Request Example

\`\`\`json
{{request_example}}
\`\`\`

## Response Examples

### Success Response (200)
\`\`\`json
{{success_response}}
\`\`\`

### Error Response (400)
\`\`\`json
{{error_response}}
\`\`\`

## Notes
{{notes}}`,
          placeholders: [
            { key: 'endpoint_name', label: 'Endpoint Name', type: 'text', required: true },
            { key: 'description', label: 'Description', type: 'textarea', required: true },
            { key: 'method', label: 'HTTP Method', type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE'], required: true },
            { key: 'path', label: 'URL Path', type: 'text', required: true },
            { key: 'request_example', label: 'Request Example', type: 'code', defaultValue: '{}' },
            { key: 'success_response', label: 'Success Response', type: 'code', defaultValue: '{}' },
            { key: 'error_response', label: 'Error Response', type: 'code', defaultValue: '{ "error": "Error message" }' },
            { key: 'notes', label: 'Additional Notes', type: 'textarea', defaultValue: 'None' }
          ],
          isDefault: true,
          tags: ['api', 'endpoint', 'reference'],
          authorId: normalizedUserId
        },
        {
          name: 'Feature Guide',
          description: 'Template for documenting product features',
          type: 'PAGE',
          category: 'GUIDE',
          content: `# {{feature_name}}

## Overview
{{overview}}

## Getting Started

### Prerequisites
{{prerequisites}}

### Setup Steps
1. {{step_1}}
2. {{step_2}}
3. {{step_3}}

## How to Use

### Basic Usage
{{basic_usage}}

### Advanced Configuration
{{advanced_config}}

## Examples

### Example 1: {{example_1_title}}
{{example_1_content}}

### Example 2: {{example_2_title}}
{{example_2_content}}

## Best Practices
{{best_practices}}

## Troubleshooting

### Common Issues
{{common_issues}}

### FAQ
{{faq}}

## Related Documentation
{{related_docs}}`,
          placeholders: [
            { key: 'feature_name', label: 'Feature Name', type: 'text', required: true },
            { key: 'overview', label: 'Feature Overview', type: 'textarea', required: true },
            { key: 'prerequisites', label: 'Prerequisites', type: 'textarea', defaultValue: 'None' },
            { key: 'step_1', label: 'Setup Step 1', type: 'text', required: true },
            { key: 'step_2', label: 'Setup Step 2', type: 'text', required: true },
            { key: 'step_3', label: 'Setup Step 3', type: 'text', required: true },
            { key: 'basic_usage', label: 'Basic Usage Instructions', type: 'textarea', required: true },
            { key: 'advanced_config', label: 'Advanced Configuration', type: 'textarea', defaultValue: 'No advanced configuration available.' },
            { key: 'example_1_title', label: 'Example 1 Title', type: 'text', defaultValue: 'Basic Example' },
            { key: 'example_1_content', label: 'Example 1 Content', type: 'textarea', required: true },
            { key: 'example_2_title', label: 'Example 2 Title', type: 'text', defaultValue: 'Advanced Example' },
            { key: 'example_2_content', label: 'Example 2 Content', type: 'textarea', defaultValue: 'Coming soon...' },
            { key: 'best_practices', label: 'Best Practices', type: 'textarea', required: true },
            { key: 'common_issues', label: 'Common Issues', type: 'textarea', defaultValue: 'No known issues.' },
            { key: 'faq', label: 'Frequently Asked Questions', type: 'textarea', defaultValue: 'No FAQ available yet.' },
            { key: 'related_docs', label: 'Related Documentation', type: 'textarea', defaultValue: 'None' }
          ],
          isDefault: true,
          tags: ['guide', 'feature', 'tutorial'],
          authorId: normalizedUserId
        },
        {
          name: 'Troubleshooting Guide',
          description: 'Template for troubleshooting documentation',
          type: 'PAGE',
          category: 'TROUBLESHOOTING',
          content: `# {{problem_title}} - Troubleshooting Guide

## Problem Description
{{problem_description}}

## Symptoms
{{symptoms}}

## Possible Causes
1. {{cause_1}}
2. {{cause_2}}
3. {{cause_3}}

## Solutions

### Solution 1: {{solution_1_title}}
{{solution_1_steps}}

### Solution 2: {{solution_2_title}}
{{solution_2_steps}}

### Solution 3: {{solution_3_title}}
{{solution_3_steps}}

## Prevention
{{prevention_tips}}

## When to Contact Support
{{support_criteria}}

## Related Issues
{{related_issues}}`,
          placeholders: [
            { key: 'problem_title', label: 'Problem Title', type: 'text', required: true },
            { key: 'problem_description', label: 'Problem Description', type: 'textarea', required: true },
            { key: 'symptoms', label: 'Symptoms', type: 'textarea', required: true },
            { key: 'cause_1', label: 'Possible Cause 1', type: 'text', required: true },
            { key: 'cause_2', label: 'Possible Cause 2', type: 'text', required: true },
            { key: 'cause_3', label: 'Possible Cause 3', type: 'text', required: true },
            { key: 'solution_1_title', label: 'Solution 1 Title', type: 'text', required: true },
            { key: 'solution_1_steps', label: 'Solution 1 Steps', type: 'textarea', required: true },
            { key: 'solution_2_title', label: 'Solution 2 Title', type: 'text', required: true },
            { key: 'solution_2_steps', label: 'Solution 2 Steps', type: 'textarea', required: true },
            { key: 'solution_3_title', label: 'Solution 3 Title', type: 'text', defaultValue: 'Alternative Solution' },
            { key: 'solution_3_steps', label: 'Solution 3 Steps', type: 'textarea', defaultValue: 'Contact support if other solutions don\'t work.' },
            { key: 'prevention_tips', label: 'Prevention Tips', type: 'textarea', required: true },
            { key: 'support_criteria', label: 'When to Contact Support', type: 'textarea', defaultValue: 'Contact support if none of the above solutions work.' },
            { key: 'related_issues', label: 'Related Issues', type: 'textarea', defaultValue: 'None' }
          ],
          isDefault: true,
          tags: ['troubleshooting', 'support', 'help'],
          authorId: normalizedUserId
        }
      ]

      const createdTemplates = []

      for (const templateData of defaultTemplates) {
        // Check if template already exists
        const existing = await prisma.documentationTemplate.findFirst({
          where: {
            name: templateData.name,
            category: templateData.category
          }
        })

        if (!existing) {
          const template = await prisma.documentationTemplate.create({
            data: templateData as any
          })
          createdTemplates.push(template)
        }
      }

      return NextResponse.json({
        success: true,
        created: createdTemplates.length,
        templates: createdTemplates
      })
    } catch (error) {
      console.error('Failed to seed default templates:', error)
      return NextResponse.json(
        { error: 'Failed to seed default templates' },
        { status: 500 }
      )
    }
  }
}