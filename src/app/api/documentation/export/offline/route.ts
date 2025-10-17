import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeUserId } from '@/lib/auth/utils'

// POST /api/documentation/export/offline - Generate offline documentation package
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedUserId = normalizeUserId(session.user.id)
    const body = await request.json()
    const {
      sectionIds = [],
      includeAssets = true,
      includeSearch = true,
      theme = 'light'
    } = body

    // Get all pages to export
    const where: any = { status: 'PUBLISHED' }
    if (sectionIds.length > 0) {
      where.sectionId = { in: sectionIds }
    }

    const pages = await prisma.documentationPage.findMany({
      where,
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
        },
        crossReferences: {
          include: {
            referencedPage: {
              select: {
                id: true,
                title: true,
                slug: true
              }
            }
          }
        }
      },
      orderBy: [
        { section: { sortOrder: 'asc' } },
        { sortOrder: 'asc' }
      ]
    })

    if (pages.length === 0) {
      return NextResponse.json(
        { error: 'No pages found to export' },
        { status: 404 }
      )
    }

    // Get all sections
    const sections = await prisma.documentationSection.findMany({
      where: sectionIds.length > 0
        ? { id: { in: sectionIds } }
        : { isActive: true },
      orderBy: { sortOrder: 'asc' }
    })

    // Generate offline package
    const offlinePackage = generateOfflinePackage(pages, sections, {
      includeAssets,
      includeSearch,
      theme
    })

    // Create export record
    const exportRecord = await prisma.documentationExport.create({
      data: {
        format: 'OFFLINE',
        pageCount: pages.length,
        metadata: {
          sectionCount: sections.length,
          includeAssets,
          includeSearch,
          theme,
          exportedAt: new Date().toISOString()
        },
        createdById: normalizedUserId
      }
    })

    // Return the offline package as HTML
    return new NextResponse(offlinePackage, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': 'attachment; filename="documentation-offline.html"',
        'X-Export-Id': exportRecord.id,
        'X-Page-Count': pages.length.toString()
      }
    })
  } catch (error) {
    console.error('Failed to generate offline package:', error)
    return NextResponse.json(
      { error: 'Failed to generate offline package' },
      { status: 500 }
    )
  }
}

function generateOfflinePackage(pages: any[], sections: any[], options: any): string {
  const { includeAssets, includeSearch, theme } = options

  // Generate navigation structure
  const navigation = sections.map(section => ({
    id: section.id,
    title: section.title,
    slug: section.slug,
    pages: pages.filter(p => p.sectionId === section.id).map(p => ({
      id: p.id,
      title: p.title,
      slug: p.slug
    }))
  }))

  const html = `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offline Documentation - SociallyHub</title>
  <style>
    /* Reset and base styles */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    :root {
      --primary: #3b82f6;
      --primary-dark: #2563eb;
      --background: #ffffff;
      --foreground: #0f172a;
      --muted: #f8fafc;
      --border: #e2e8f0;
      --radius: 0.5rem;
    }

    [data-theme="dark"] {
      --background: #0f172a;
      --foreground: #f8fafc;
      --muted: #1e293b;
      --border: #334155;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: var(--foreground);
      background: var(--background);
      display: flex;
      height: 100vh;
      overflow: hidden;
    }

    /* Sidebar navigation */
    .sidebar {
      width: 280px;
      background: var(--muted);
      border-right: 1px solid var(--border);
      overflow-y: auto;
      padding: 1rem;
    }

    .sidebar h2 {
      padding: 0.5rem;
      margin-bottom: 1rem;
      color: var(--primary);
    }

    .nav-section {
      margin-bottom: 1.5rem;
    }

    .nav-section-title {
      font-weight: 600;
      padding: 0.5rem;
      margin-bottom: 0.25rem;
      border-radius: var(--radius);
      cursor: pointer;
      transition: background 0.2s;
    }

    .nav-section-title:hover {
      background: var(--border);
    }

    .nav-pages {
      padding-left: 1rem;
    }

    .nav-page {
      padding: 0.375rem 0.5rem;
      border-radius: var(--radius);
      cursor: pointer;
      transition: all 0.2s;
      margin-bottom: 0.125rem;
    }

    .nav-page:hover {
      background: var(--border);
      padding-left: 0.75rem;
    }

    .nav-page.active {
      background: var(--primary);
      color: white;
    }

    /* Main content */
    .main {
      flex: 1;
      overflow-y: auto;
      padding: 2rem 3rem;
    }

    .page {
      display: none;
      animation: fadeIn 0.3s;
    }

    .page.active {
      display: block;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Content styles */
    h1 {
      font-size: 2.5rem;
      margin-bottom: 1.5rem;
      padding-bottom: 0.75rem;
      border-bottom: 2px solid var(--border);
    }

    h2 {
      font-size: 1.875rem;
      margin: 2rem 0 1rem;
      color: var(--primary);
    }

    h3 {
      font-size: 1.5rem;
      margin: 1.5rem 0 0.75rem;
    }

    p {
      margin-bottom: 1rem;
    }

    pre {
      background: var(--muted);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1rem;
      overflow-x: auto;
      margin: 1rem 0;
    }

    code {
      background: var(--muted);
      padding: 0.125rem 0.25rem;
      border-radius: 0.25rem;
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.875em;
    }

    pre code {
      background: transparent;
      padding: 0;
    }

    .code-example {
      margin: 1.5rem 0;
      border-left: 4px solid var(--primary);
      padding-left: 1rem;
    }

    .code-example h4 {
      margin-bottom: 0.5rem;
      color: var(--primary);
    }

    .metadata {
      background: var(--muted);
      padding: 1rem;
      border-radius: var(--radius);
      margin-bottom: 1.5rem;
      font-size: 0.875rem;
    }

    .cross-reference {
      color: var(--primary);
      text-decoration: none;
      cursor: pointer;
      border-bottom: 1px dashed var(--primary);
    }

    .cross-reference:hover {
      border-bottom-style: solid;
    }

    /* Search box */
    ${includeSearch ? `
    .search-container {
      padding: 1rem;
      border-bottom: 1px solid var(--border);
      margin-bottom: 1rem;
    }

    .search-input {
      width: 100%;
      padding: 0.5rem 1rem;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--background);
      color: var(--foreground);
      font-size: 0.875rem;
    }

    .search-results {
      position: absolute;
      top: 100%;
      left: 1rem;
      right: 1rem;
      background: var(--background);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      max-height: 300px;
      overflow-y: auto;
      display: none;
      z-index: 1000;
    }

    .search-results.active {
      display: block;
    }

    .search-result {
      padding: 0.75rem;
      border-bottom: 1px solid var(--border);
      cursor: pointer;
    }

    .search-result:hover {
      background: var(--muted);
    }

    .search-result-title {
      font-weight: 600;
      margin-bottom: 0.25rem;
    }

    .search-result-excerpt {
      font-size: 0.875rem;
      color: #64748b;
    }
    ` : ''}

    /* Theme toggle */
    .theme-toggle {
      position: fixed;
      top: 1rem;
      right: 1rem;
      padding: 0.5rem 1rem;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: var(--radius);
      cursor: pointer;
      font-size: 0.875rem;
      z-index: 1000;
    }

    .theme-toggle:hover {
      background: var(--primary-dark);
    }

    /* Responsive design */
    @media (max-width: 768px) {
      .sidebar {
        width: 100%;
        position: fixed;
        left: -100%;
        top: 0;
        bottom: 0;
        z-index: 999;
        transition: left 0.3s;
      }

      .sidebar.open {
        left: 0;
      }

      .menu-toggle {
        display: block;
        position: fixed;
        top: 1rem;
        left: 1rem;
        z-index: 1001;
        padding: 0.5rem;
        background: var(--primary);
        color: white;
        border: none;
        border-radius: var(--radius);
        cursor: pointer;
      }

      .main {
        padding: 4rem 1rem 2rem;
      }
    }

    @media (min-width: 769px) {
      .menu-toggle {
        display: none;
      }
    }
  </style>
</head>
<body>
  <!-- Theme Toggle -->
  <button class="theme-toggle" onclick="toggleTheme()">🌓 Toggle Theme</button>

  <!-- Mobile Menu Toggle -->
  <button class="menu-toggle" onclick="toggleSidebar()">☰ Menu</button>

  <!-- Sidebar Navigation -->
  <nav class="sidebar" id="sidebar">
    <h2>Documentation</h2>

    ${includeSearch ? `
    <div class="search-container">
      <input
        type="text"
        class="search-input"
        placeholder="Search documentation..."
        oninput="searchDocs(this.value)"
      />
      <div class="search-results" id="searchResults"></div>
    </div>
    ` : ''}

    <div class="navigation">
      ${navigation.map(section => `
      <div class="nav-section">
        <div class="nav-section-title" onclick="toggleSection('${section.id}')">
          📁 ${section.title}
        </div>
        <div class="nav-pages" id="section-${section.id}">
          ${section.pages.map(page => `
          <div class="nav-page" onclick="showPage('${page.slug}')" data-page="${page.slug}">
            ${page.title}
          </div>
          `).join('')}
        </div>
      </div>
      `).join('')}
    </div>
  </nav>

  <!-- Main Content Area -->
  <main class="main" id="main">
    <!-- Welcome page -->
    <div class="page active" id="page-welcome">
      <h1>Welcome to Offline Documentation</h1>
      <p>This is an offline version of the SociallyHub documentation.</p>
      <p>Use the navigation on the left to browse through the documentation pages.</p>

      <h2>Features</h2>
      <ul>
        <li>📚 Complete documentation available offline</li>
        <li>🔍 ${includeSearch ? 'Search functionality included' : 'Browse by section'}</li>
        <li>🎨 ${theme === 'dark' ? 'Dark' : 'Light'} theme (toggle available)</li>
        <li>📱 Responsive design for mobile and desktop</li>
      </ul>

      <h2>Statistics</h2>
      <ul>
        <li>Total Sections: ${sections.length}</li>
        <li>Total Pages: ${pages.length}</li>
        <li>Generated: ${new Date().toLocaleString()}</li>
      </ul>
    </div>

    <!-- Documentation Pages -->
    ${pages.map(page => `
    <div class="page" id="page-${page.slug}">
      <h1>${page.title}</h1>

      <div class="metadata">
        <strong>Section:</strong> ${page.section.title} |
        <strong>Author:</strong> ${page.author.name} |
        <strong>Last Updated:</strong> ${new Date(page.updatedAt).toLocaleDateString()}
      </div>

      <div class="content">
        ${formatContent(page.content, page.crossReferences)}
      </div>

      ${page.codeExamples && page.codeExamples.length > 0 ? `
      <h2>Code Examples</h2>
      ${page.codeExamples.map((example: any) => `
      <div class="code-example">
        <h4>${example.title}</h4>
        ${example.description ? `<p>${example.description}</p>` : ''}
        <pre><code class="language-${example.language.toLowerCase()}">${escapeHtml(example.code)}</code></pre>
      </div>
      `).join('')}
      ` : ''}
    </div>
    `).join('')}
  </main>

  <script>
    // Store all pages data for search
    const pagesData = ${JSON.stringify(pages.map(p => ({
      slug: p.slug,
      title: p.title,
      content: p.content.substring(0, 500),
      section: p.section.title
    })))};

    // Current active page
    let currentPage = 'welcome';

    // Show a specific page
    function showPage(slug) {
      // Hide all pages
      document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
      });

      // Show selected page
      const page = document.getElementById('page-' + slug);
      if (page) {
        page.classList.add('active');
        currentPage = slug;

        // Update navigation active state
        document.querySelectorAll('.nav-page').forEach(nav => {
          nav.classList.remove('active');
        });
        document.querySelector('[data-page="' + slug + '"]')?.classList.add('active');

        // Close mobile menu if open
        if (window.innerWidth <= 768) {
          document.getElementById('sidebar').classList.remove('open');
        }

        // Scroll to top
        document.getElementById('main').scrollTop = 0;
      }
    }

    // Toggle section in navigation
    function toggleSection(sectionId) {
      const section = document.getElementById('section-' + sectionId);
      if (section) {
        section.style.display = section.style.display === 'none' ? 'block' : 'none';
      }
    }

    // Toggle theme
    function toggleTheme() {
      const html = document.documentElement;
      const currentTheme = html.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
    }

    // Toggle sidebar (mobile)
    function toggleSidebar() {
      document.getElementById('sidebar').classList.toggle('open');
    }

    ${includeSearch ? `
    // Search functionality
    function searchDocs(query) {
      const resultsContainer = document.getElementById('searchResults');

      if (!query || query.length < 2) {
        resultsContainer.classList.remove('active');
        return;
      }

      const results = pagesData.filter(page => {
        const searchText = (page.title + ' ' + page.content + ' ' + page.section).toLowerCase();
        return searchText.includes(query.toLowerCase());
      });

      if (results.length > 0) {
        resultsContainer.innerHTML = results.slice(0, 10).map(result => \`
          <div class="search-result" onclick="showPage('\${result.slug}')">
            <div class="search-result-title">\${result.title}</div>
            <div class="search-result-excerpt">\${result.section}</div>
          </div>
        \`).join('');
        resultsContainer.classList.add('active');
      } else {
        resultsContainer.innerHTML = '<div class="search-result">No results found</div>';
        resultsContainer.classList.add('active');
      }
    }

    // Close search results when clicking outside
    document.addEventListener('click', function(event) {
      const searchContainer = document.querySelector('.search-container');
      if (searchContainer && !searchContainer.contains(event.target)) {
        document.getElementById('searchResults').classList.remove('active');
      }
    });
    ` : ''}

    // Load saved theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }

    // Handle cross-references
    function navigateToPage(slug) {
      showPage(slug);
    }
  </script>
</body>
</html>`

  return html
}

function formatContent(content: string, crossReferences: any[]): string {
  let formatted = content
    // Basic markdown to HTML conversion
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')

  // Add cross-references
  crossReferences?.forEach(ref => {
    if (ref.referencedPage) {
      const linkText = ref.linkText || ref.referencedPage.title
      const link = `<a class="cross-reference" onclick="navigateToPage('${ref.referencedPage.slug}')">${linkText}</a>`
      formatted = formatted.replace(new RegExp(linkText, 'g'), link)
    }
  })

  return `<p>${formatted}</p>`
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