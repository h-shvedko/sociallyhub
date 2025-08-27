export interface Campaign {
  id: string
  workspaceId: string
  clientId?: string
  name: string
  description?: string
  status: CampaignStatus
  type: CampaignType
  startDate?: string
  endDate?: string
  budget?: CampaignBudget
  objectives?: CampaignObjective[]
  abTesting?: ABTestConfig
  targeting?: CampaignTargeting
  templates?: CampaignTemplate[]
  createdAt: string
  updatedAt: string
  
  // Relations
  workspace?: Workspace
  client?: Client
  posts?: Post[]
  analytics?: CampaignAnalytics[]
  reports?: CampaignReport[]
}

export enum CampaignStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum CampaignType {
  BRAND_AWARENESS = 'BRAND_AWARENESS',
  LEAD_GENERATION = 'LEAD_GENERATION',
  ENGAGEMENT = 'ENGAGEMENT',
  SALES = 'SALES',
  PRODUCT_LAUNCH = 'PRODUCT_LAUNCH',
  EVENT_PROMOTION = 'EVENT_PROMOTION',
  CONTENT_SERIES = 'CONTENT_SERIES',
  CUSTOM = 'CUSTOM'
}

export interface CampaignBudget {
  totalBudget?: number
  dailyBudget?: number
  currency: string
  spentAmount: number
  remainingAmount: number
  budgetPacing: 'EVEN' | 'ACCELERATED' | 'CUSTOM'
  costPerAction?: number
  costPerClick?: number
  costPerImpression?: number
}

export interface CampaignObjective {
  id: string
  type: ObjectiveType
  name: string
  description?: string
  targetValue: number
  currentValue: number
  unit: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  deadline?: string
  isCompleted: boolean
}

export enum ObjectiveType {
  REACH = 'REACH',
  IMPRESSIONS = 'IMPRESSIONS',
  ENGAGEMENT = 'ENGAGEMENT',
  CLICKS = 'CLICKS',
  CONVERSIONS = 'CONVERSIONS',
  LEADS = 'LEADS',
  SALES_REVENUE = 'SALES_REVENUE',
  BRAND_MENTIONS = 'BRAND_MENTIONS',
  FOLLOWERS = 'FOLLOWERS',
  WEBSITE_TRAFFIC = 'WEBSITE_TRAFFIC'
}

export interface ABTestConfig {
  isEnabled: boolean
  testName: string
  variants: ABTestVariant[]
  splitPercentage: number[]
  winner?: string
  confidenceLevel: number
  minSampleSize: number
  testDuration?: number // in days
  metrics: string[]
  status: 'SETUP' | 'RUNNING' | 'COMPLETED' | 'CANCELLED'
  startDate?: string
  endDate?: string
}

export interface ABTestVariant {
  id: string
  name: string
  description?: string
  content: string
  mediaUrls?: string[]
  hashtags?: string[]
  platforms: string[]
  postTime?: string
  audience?: CampaignTargeting
  performance?: VariantPerformance
}

export interface VariantPerformance {
  impressions: number
  reach: number
  clicks: number
  engagement: number
  conversions: number
  cost: number
  conversionRate: number
  clickThroughRate: number
  engagementRate: number
  costPerConversion: number
}

export interface CampaignTargeting {
  demographics?: {
    ageRange?: [number, number]
    genders?: string[]
    locations?: string[]
    languages?: string[]
  }
  interests?: string[]
  behaviors?: string[]
  platforms: string[]
  customAudiences?: string[]
  lookalikes?: string[]
  excludeAudiences?: string[]
  deviceTypes?: string[]
  placements?: string[]
}

export interface CampaignTemplate {
  id: string
  name: string
  description?: string
  category: string
  platforms: string[]
  content: {
    text: string
    mediaUrls?: string[]
    hashtags?: string[]
    variables?: TemplateVariable[]
  }
  scheduling?: {
    frequency: 'DAILY' | 'WEEKLY' | 'CUSTOM'
    times: string[]
    timezone: string
  }
  isReusable: boolean
  usageCount: number
  createdAt: string
}

export interface TemplateVariable {
  key: string
  type: 'TEXT' | 'NUMBER' | 'DATE' | 'URL' | 'IMAGE'
  label: string
  defaultValue?: string
  isRequired: boolean
  options?: string[]
}

export interface CampaignAnalytics {
  id: string
  campaignId: string
  date: string
  platform?: string
  metrics: {
    impressions: number
    reach: number
    clicks: number
    engagement: number
    shares: number
    comments: number
    likes: number
    saves: number
    conversions: number
    leads: number
    revenue?: number
    cost: number
    followers_gained: number
    followers_lost: number
    mentions: number
    sentiment_score: number
    video_views?: number
    video_completion_rate?: number
  }
  demographics?: {
    age_groups: Record<string, number>
    genders: Record<string, number>
    locations: Record<string, number>
    devices: Record<string, number>
  }
  createdAt: string
}

export interface CampaignReport {
  id: string
  campaignId: string
  name: string
  type: 'PERFORMANCE' | 'EXECUTIVE' | 'DETAILED' | 'AB_TEST' | 'CUSTOM'
  format: 'PDF' | 'EXCEL' | 'CSV' | 'HTML'
  dateRange: {
    startDate: string
    endDate: string
  }
  sections: ReportSection[]
  isScheduled: boolean
  frequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  recipients?: string[]
  generatedAt?: string
  downloadUrl?: string
  createdAt: string
}

export interface ReportSection {
  type: 'OVERVIEW' | 'PERFORMANCE' | 'DEMOGRAPHICS' | 'CONTENT' | 'BUDGET' | 'AB_TEST' | 'RECOMMENDATIONS'
  title: string
  isIncluded: boolean
  config?: Record<string, any>
}

export interface CampaignFormData {
  name: string
  description: string
  type: CampaignType
  startDate?: Date
  endDate?: Date
  budget?: Partial<CampaignBudget>
  objectives: Omit<CampaignObjective, 'id' | 'currentValue' | 'isCompleted'>[]
  abTesting?: Partial<ABTestConfig>
  targeting?: CampaignTargeting
  clientId?: string
}

// API Response Types
export interface CampaignListResponse {
  campaigns: Campaign[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  filters?: {
    status?: CampaignStatus[]
    type?: CampaignType[]
    dateRange?: {
      startDate: string
      endDate: string
    }
  }
}

export interface CampaignStatsResponse {
  overview: {
    totalCampaigns: number
    activeCampaigns: number
    completedCampaigns: number
    totalBudget: number
    spentBudget: number
    totalReach: number
    totalEngagement: number
    totalConversions: number
    averageROI: number
  }
  breakdowns: {
    byStatus: Record<CampaignStatus, number>
    byType: Record<CampaignType, number>
    byPlatform: Record<string, number>
    byMonth: Array<{
      month: string
      campaigns: number
      budget: number
      performance: {
        reach: number
        engagement: number
        conversions: number
      }
    }>
  }
  topPerformers: Array<{
    campaignId: string
    name: string
    roi: number
    reach: number
    engagement: number
  }>
}

// Component Props Types
export interface CampaignCardProps {
  campaign: Campaign
  onEdit: (campaign: Campaign) => void
  onDelete: (campaignId: string) => void
  onDuplicate: (campaign: Campaign) => void
  onToggleStatus: (campaignId: string, status: CampaignStatus) => void
}

export interface CampaignFiltersProps {
  filters: {
    status: CampaignStatus[]
    type: CampaignType[]
    dateRange?: {
      startDate: Date
      endDate: Date
    }
    search: string
    clientId?: string
  }
  onFiltersChange: (filters: any) => void
  workspaceId: string
}

export interface ABTestResultsProps {
  abTest: ABTestConfig
  variants: ABTestVariant[]
  onSelectWinner: (variantId: string) => void
  onEndTest: () => void
}