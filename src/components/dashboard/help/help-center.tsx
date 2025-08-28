'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Search, 
  Book, 
  MessageCircle, 
  HelpCircle,
  Video,
  FileText,
  ExternalLink,
  ChevronRight,
  Mail,
  Phone,
  Clock,
  CheckCircle,
  Lightbulb,
  Zap,
  Users,
  BarChart3,
  Calendar,
  Settings
} from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { useDictionary } from '@/hooks/use-dictionary'

interface HelpArticle {
  id: string
  title: string
  description: string
  category: string
  views: number
  helpful: number
  lastUpdated: string
}

interface FAQ {
  question: string
  answer: string
  category: string
}

export function HelpCenter() {
  const { t, isLoading } = useDictionary()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  const categories = [
    { id: 'all', name: t('help.allTopics', 'All Topics'), icon: Book },
    { id: 'getting-started', name: t('help.gettingStarted', 'Getting Started'), icon: Lightbulb },
    { id: 'posting', name: t('help.contentPosting', 'Content & Posting'), icon: FileText },
    { id: 'analytics', name: t('help.analytics', 'Analytics'), icon: BarChart3 },
    { id: 'team', name: t('help.teamManagement', 'Team Management'), icon: Users },
    { id: 'automation', name: t('help.aiAutomation', 'AI & Automation'), icon: Zap },
    { id: 'integrations', name: t('help.integrations', 'Integrations'), icon: Settings },
    { id: 'billing', name: t('help.billingPlans', 'Billing & Plans'), icon: CheckCircle }
  ]

  const helpArticles: HelpArticle[] = [
    {
      id: '1',
      title: 'Getting Started with SociallyHub',
      description: 'Learn the basics of setting up your workspace and connecting social accounts',
      category: 'getting-started',
      views: 1250,
      helpful: 95,
      lastUpdated: '2024-01-15'
    },
    {
      id: '2',
      title: 'How to Schedule Posts Across Multiple Platforms',
      description: 'Step-by-step guide to creating and scheduling content for all your social media accounts',
      category: 'posting',
      views: 890,
      helpful: 87,
      lastUpdated: '2024-01-12'
    },
    {
      id: '3',
      title: 'Understanding Your Analytics Dashboard',
      description: 'Make sense of your social media performance with detailed analytics insights',
      category: 'analytics',
      views: 670,
      helpful: 92,
      lastUpdated: '2024-01-10'
    },
    {
      id: '4',
      title: 'Setting Up AI-Powered Content Optimization',
      description: 'Leverage AI to improve your content performance and engagement rates',
      category: 'automation',
      views: 540,
      helpful: 88,
      lastUpdated: '2024-01-08'
    },
    {
      id: '5',
      title: 'Managing Team Roles and Permissions',
      description: 'Control who can access what in your workspace with role-based permissions',
      category: 'team',
      views: 430,
      helpful: 94,
      lastUpdated: '2024-01-05'
    }
  ]

  const faqs: FAQ[] = [
    {
      question: 'How do I connect my social media accounts?',
      answer: 'Go to the Accounts page in your dashboard and click "Connect Account". Choose your platform and follow the OAuth flow to authorize SociallyHub to manage your account.',
      category: 'getting-started'
    },
    {
      question: 'Can I schedule posts for different time zones?',
      answer: 'Yes! You can set your workspace timezone in Settings, and all scheduled posts will be published according to that timezone. You can also schedule posts for specific times in different zones.',
      category: 'posting'
    },
    {
      question: 'What social platforms does SociallyHub support?',
      answer: 'We currently support Twitter/X, Facebook, Instagram, LinkedIn, TikTok, and YouTube. We\'re constantly adding support for new platforms based on user demand.',
      category: 'integrations'
    },
    {
      question: 'How does the AI content optimization work?',
      answer: 'Our AI analyzes your past performance, current trends, and best practices to suggest improvements to your content, optimal posting times, and hashtag strategies.',
      category: 'automation'
    },
    {
      question: 'Can I invite team members to collaborate?',
      answer: 'Absolutely! You can invite team members with different permission levels: Viewer, Editor, Manager, or Admin. Each role has specific capabilities to maintain security and workflow.',
      category: 'team'
    },
    {
      question: 'How accurate are the analytics and performance predictions?',
      answer: 'Our analytics are real-time and sourced directly from platform APIs. Performance predictions use machine learning with 75-85% accuracy based on historical data and trends.',
      category: 'analytics'
    }
  ]

  const filteredArticles = helpArticles.filter(article => {
    const matchesSearch = searchQuery === '' || 
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.description.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesCategory = selectedCategory === 'all' || article.category === selectedCategory
    
    return matchesSearch && matchesCategory
  })

  const filteredFAQs = faqs.filter(faq => {
    const matchesSearch = searchQuery === '' || 
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory
    
    return matchesSearch && matchesCategory
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col space-y-6">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">{t('help.title', 'Help Center')}</h1>
        <p className="text-xl text-muted-foreground">
          {t('help.description', 'Get help, tutorials, and support for using SociallyHub effectively')}
        </p>
        
        {/* Search */}
        <div className="max-w-2xl mx-auto relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('help.searchPlaceholder', 'Search help articles, guides, and FAQs...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 text-lg"
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <Book className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold">{t('help.documentation', 'Documentation')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('help.documentationDescription', 'Comprehensive guides and API documentation')}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <MessageCircle className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-semibold">{t('help.liveChat', 'Live Chat')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('help.liveChatDescription', 'Get instant help from our support team')}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                <Video className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="font-semibold">{t('help.videoTutorials', 'Video Tutorials')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('help.videoTutorialsDescription', 'Watch step-by-step video guides')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Categories Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>{t('help.categories', 'Categories')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {categories.map((category) => {
                  const Icon = category.icon
                  return (
                    <Button
                      key={category.id}
                      variant={selectedCategory === category.id ? 'default' : 'ghost'}
                      className="w-full justify-start"
                      onClick={() => setSelectedCategory(category.id)}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {category.name}
                    </Button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Help Articles */}
          <Card>
            <CardHeader>
              <CardTitle>{t('help.helpArticles', 'Help Articles')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredArticles.map((article) => (
                  <div key={article.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">{article.title}</h3>
                      <p className="text-muted-foreground text-sm mb-2">{article.description}</p>
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                        <span>{article.views} views</span>
                        <span>{article.helpful}% helpful</span>
                        <span>Updated {new Date(article.lastUpdated).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* FAQs */}
          <Card>
            <CardHeader>
              <CardTitle>{t('help.faqs', 'Frequently Asked Questions')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {filteredFAQs.map((faq, index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger className="text-left">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          {/* Contact Support */}
          <Card>
            <CardHeader>
              <CardTitle>Still Need Help?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="font-semibold">Contact Support</h3>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>support@sociallyhub.com</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <MessageCircle className="h-4 w-4 text-muted-foreground" />
                      <span>Live chat available 24/7</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>Average response time: 2 hours</span>
                    </div>
                  </div>
                  <Button className="w-full">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Start Live Chat
                  </Button>
                </div>
                
                <div className="space-y-3">
                  <h3 className="font-semibold">Community</h3>
                  <p className="text-sm text-muted-foreground">
                    Join our community to get help from other users and share tips
                  </p>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Community Forum
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Discord Server
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Feature Requests
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}