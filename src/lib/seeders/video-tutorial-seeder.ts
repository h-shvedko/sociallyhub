import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Demo video tutorials with realistic data
const VIDEO_TUTORIALS = [
  {
    title: "Getting Started with SociallyHub",
    slug: "getting-started-sociallyhub",
    description: "Learn the basics of setting up your SociallyHub account and connecting your first social media platform. This comprehensive guide covers account setup, dashboard navigation, and initial configuration.",
    thumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    videoPlatform: "youtube",
    videoId: "dQw4w9WgXcQ",
    duration: 420, // 7 minutes
    difficulty: "beginner",
    tags: ["setup", "basics", "getting-started", "onboarding"],
    transcript: "Welcome to SociallyHub! In this tutorial, we'll walk you through the essential steps to get started with your social media management journey. First, let's create your account and verify your email address. Once you're logged in, you'll see the main dashboard with various sections for managing your social media presence. The sidebar contains navigation to different areas like Posts, Analytics, Campaigns, and Settings. Let's start by connecting your first social media account...",
    authorName: "Sarah Johnson",
    authorAvatar: "https://ui-avatars.com/api/?name=Sarah+Johnson&background=6366f1&color=ffffff",
    categorySlug: "getting-started",
    isFeatured: true
  },
  {
    title: "Creating Your First Social Media Post",
    slug: "creating-first-social-media-post",
    description: "Step-by-step guide to creating, scheduling, and publishing your first post across multiple social media platforms using SociallyHub's unified posting interface.",
    thumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    videoPlatform: "youtube",
    videoId: "dQw4w9WgXcQ",
    duration: 360, // 6 minutes
    difficulty: "beginner",
    tags: ["posting", "content-creation", "scheduling", "social-media"],
    transcript: "Now that you have your accounts connected, let's create your first post. Navigate to the Posts section and click 'New Post'. You'll see a composer where you can write your content. Notice how you can customize the post for different platforms - what works on Twitter might need adjustment for LinkedIn. Add your images, schedule your post, and review before publishing.",
    authorName: "Mike Chen",
    authorAvatar: "https://ui-avatars.com/api/?name=Mike+Chen&background=10b981&color=ffffff",
    categorySlug: "content-management",
    isFeatured: true
  },
  {
    title: "Advanced Analytics and Reporting",
    slug: "advanced-analytics-reporting",
    description: "Dive deep into SociallyHub's analytics features. Learn how to track performance metrics, create custom reports, and gain insights to improve your social media strategy.",
    thumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    videoPlatform: "youtube",
    videoId: "dQw4w9WgXcQ",
    duration: 720, // 12 minutes
    difficulty: "intermediate",
    tags: ["analytics", "reporting", "metrics", "insights", "performance"],
    transcript: "Analytics are crucial for understanding your social media performance. In this tutorial, we'll explore SociallyHub's comprehensive analytics dashboard. You can view engagement rates, reach, impressions, and click-through rates across all your connected platforms. The custom report builder allows you to create tailored reports for different stakeholders. Let's walk through creating a monthly performance report...",
    authorName: "Lisa Rodriguez",
    authorAvatar: "https://ui-avatars.com/api/?name=Lisa+Rodriguez&background=f59e0b&color=ffffff",
    categorySlug: "analytics",
    isFeatured: true
  },
  {
    title: "Setting Up Automated Campaigns",
    slug: "setting-up-automated-campaigns",
    description: "Learn how to create and manage automated marketing campaigns that run across multiple social platforms, including A/B testing and performance optimization.",
    thumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    videoPlatform: "youtube",
    videoId: "dQw4w9WgXcQ",
    duration: 900, // 15 minutes
    difficulty: "advanced",
    tags: ["campaigns", "automation", "ab-testing", "marketing", "optimization"],
    transcript: "Campaigns in SociallyHub allow you to orchestrate complex marketing initiatives across multiple platforms. In this advanced tutorial, we'll create a multi-platform campaign with A/B testing capabilities. We'll set up different content variants, define our target audience, set budgets, and configure performance tracking. The campaign automation features will help you scale your marketing efforts efficiently...",
    authorName: "David Kim",
    authorAvatar: "https://ui-avatars.com/api/?name=David+Kim&background=8b5cf6&color=ffffff",
    categorySlug: "campaigns",
    isFeatured: false
  },
  {
    title: "Managing Client Relationships",
    slug: "managing-client-relationships",
    description: "For agencies and freelancers: learn how to set up client workspaces, manage permissions, create client reports, and streamline your client communication workflow.",
    thumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    videoPlatform: "youtube",
    videoId: "dQw4w9WgXcQ",
    duration: 600, // 10 minutes
    difficulty: "intermediate",
    tags: ["clients", "agencies", "permissions", "reporting", "workflow"],
    transcript: "If you're managing social media for clients, SociallyHub's client management features are essential. We'll walk through creating separate workspaces for each client, setting up appropriate user permissions, and generating automated client reports. The client portal allows your clients to review and approve content before it goes live, streamlining your approval workflow...",
    authorName: "Emma Thompson",
    authorAvatar: "https://ui-avatars.com/api/?name=Emma+Thompson&background=ec4899&color=ffffff",
    categorySlug: "clients",
    isFeatured: false
  },
  {
    title: "API Integration and Custom Workflows",
    slug: "api-integration-custom-workflows",
    description: "Advanced technical tutorial covering SociallyHub's API capabilities, webhook configurations, and how to build custom integrations with your existing tools and workflows.",
    thumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    videoPlatform: "youtube",
    videoId: "dQw4w9WgXcQ",
    duration: 1080, // 18 minutes
    difficulty: "advanced",
    tags: ["api", "integration", "webhooks", "automation", "development"],
    transcript: "For developers and advanced users, SociallyHub provides a comprehensive API for custom integrations. In this technical tutorial, we'll cover authentication, common API endpoints, webhook setup, and practical examples of custom workflow automation. We'll build a simple integration that automatically posts content based on external triggers...",
    authorName: "Alex Rodriguez",
    authorAvatar: "https://ui-avatars.com/api/?name=Alex+Rodriguez&background=059669&color=ffffff",
    categorySlug: "integration",
    isFeatured: false
  },
  {
    title: "Content Calendar Best Practices",
    slug: "content-calendar-best-practices",
    description: "Learn how to plan, organize, and schedule your content effectively using SociallyHub's calendar interface. Includes tips for content planning and batch scheduling.",
    thumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    videoPlatform: "youtube",
    videoId: "dQw4w9WgXcQ",
    duration: 480, // 8 minutes
    difficulty: "beginner",
    tags: ["calendar", "planning", "scheduling", "organization", "content-strategy"],
    transcript: "A well-organized content calendar is the backbone of successful social media management. In this tutorial, we'll explore SociallyHub's calendar features and share best practices for content planning. You'll learn how to batch schedule content, organize posts by themes, and maintain a consistent posting schedule across all your platforms...",
    authorName: "Jennifer Walsh",
    authorAvatar: "https://ui-avatars.com/api/?name=Jennifer+Walsh&background=dc2626&color=ffffff",
    categorySlug: "content-management",
    isFeatured: false
  },
  {
    title: "Team Collaboration and Permissions",
    slug: "team-collaboration-permissions",
    description: "Set up your team for success with proper user roles, permissions, and collaboration workflows. Learn how to manage large teams and maintain content quality.",
    thumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    videoPlatform: "youtube",
    videoId: "dQw4w9WgXcQ",
    duration: 540, // 9 minutes
    difficulty: "intermediate",
    tags: ["team", "collaboration", "permissions", "workflow", "management"],
    transcript: "Working with a team requires careful coordination and clear permissions. This tutorial covers setting up user roles, creating approval workflows, and establishing content guidelines. We'll demonstrate how to assign different permission levels to team members and set up approval chains to ensure content quality and brand consistency...",
    authorName: "Robert Taylor",
    authorAvatar: "https://ui-avatars.com/api/?name=Robert+Taylor&background=1d4ed8&color=ffffff",
    categorySlug: "team-management",
    isFeatured: false
  }
]

export async function seedVideoTutorials() {
  console.log('🎥 Seeding video tutorials...')

  try {
    // First, get all help categories to map tutorials to them
    const categories = await prisma.helpCategory.findMany({
      select: { id: true, slug: true }
    })

    const categoryMap = new Map(categories.map(cat => [cat.slug, cat.id]))

    // Create video tutorials
    const tutorials = []
    for (const tutorial of VIDEO_TUTORIALS) {
      const categoryId = categoryMap.get(tutorial.categorySlug)
      if (!categoryId) {
        console.warn(`⚠️  Category not found for slug: ${tutorial.categorySlug}`)
        continue
      }

      const { categorySlug, ...tutorialData } = tutorial

      const createdTutorial = await prisma.videoTutorial.create({
        data: {
          ...tutorialData,
          categoryId,
          views: Math.floor(Math.random() * 5000) + 100, // Random views between 100-5100
          likes: Math.floor(Math.random() * 500) + 10, // Random likes between 10-510
          averageRating: parseFloat((Math.random() * 2 + 3).toFixed(1)), // Random rating between 3.0-5.0
          completions: Math.floor(Math.random() * 1000) + 50,
          isActive: true,
          isPublished: true,
          publishedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date within last 30 days
          sortOrder: tutorials.length + 1
        }
      })

      tutorials.push(createdTutorial)
    }

    console.log(`✅ Created ${tutorials.length} video tutorials`)

    // Create some sample user progress for the first few tutorials
    const users = await prisma.user.findMany({ take: 10 })
    if (users.length > 0) {
      const progressData = []

      for (let i = 0; i < Math.min(3, tutorials.length); i++) {
        const tutorial = tutorials[i]

        for (let j = 0; j < Math.min(5, users.length); j++) {
          const user = users[j]
          const watchTime = Math.floor(Math.random() * tutorial.duration)
          const isCompleted = watchTime >= tutorial.duration * 0.9

          progressData.push({
            userId: user.id,
            videoId: tutorial.id,
            watchTime,
            lastPosition: watchTime,
            isCompleted,
            rating: Math.random() > 0.3 ? Math.floor(Math.random() * 5) + 1 : null, // 70% chance of rating
            feedback: Math.random() > 0.5 ? [
              "Great tutorial! Very helpful.",
              "Clear explanations, easy to follow.",
              "Could use more examples.",
              "Perfect for beginners.",
              "Excellent content quality."
            ][Math.floor(Math.random() * 5)] : null,
            createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random date within last 7 days
            updatedAt: new Date()
          })
        }
      }

      if (progressData.length > 0) {
        await prisma.videoUserProgress.createMany({
          data: progressData,
          skipDuplicates: true
        })
        console.log(`✅ Created ${progressData.length} user progress records`)
      }
    }

    console.log('🎥 Video tutorial seeding completed successfully!')
    return tutorials

  } catch (error) {
    console.error('❌ Error seeding video tutorials:', error)
    throw error
  }
}

export async function cleanupVideoTutorials() {
  console.log('🧹 Cleaning up video tutorials...')

  try {
    await prisma.videoUserProgress.deleteMany()
    await prisma.videoTutorial.deleteMany()
    console.log('✅ Video tutorials cleanup completed')
  } catch (error) {
    console.error('❌ Error cleaning up video tutorials:', error)
    throw error
  }
}