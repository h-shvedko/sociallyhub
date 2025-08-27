// User Onboarding Flow Types
export interface OnboardingStep {
  id: string
  title: string
  description: string
  component: string
  status: OnboardingStepStatus
  order: number
  required: boolean
  estimatedTime: number // in minutes
  completedAt?: Date
  skippedAt?: Date
  dependencies?: string[] // step IDs that must be completed first
  category: OnboardingCategory
  helpContent?: HelpContent
}

export enum OnboardingStepStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS', 
  COMPLETED = 'COMPLETED',
  SKIPPED = 'SKIPPED',
  BLOCKED = 'BLOCKED'
}

export enum OnboardingCategory {
  WELCOME = 'WELCOME',
  ACCOUNT_SETUP = 'ACCOUNT_SETUP',
  SOCIAL_CONNECTIONS = 'SOCIAL_CONNECTIONS',
  CONTENT_CREATION = 'CONTENT_CREATION',
  TEAM_SETUP = 'TEAM_SETUP',
  ANALYTICS = 'ANALYTICS',
  COMPLETION = 'COMPLETION'
}

export interface OnboardingFlow {
  id: string
  name: string
  description: string
  targetUserType: UserType
  estimatedDuration: number // in minutes
  steps: OnboardingStep[]
  currentStepId?: string
  completionPercentage: number
  startedAt?: Date
  completedAt?: Date
  metadata?: OnboardingMetadata
}

export enum UserType {
  INDIVIDUAL = 'INDIVIDUAL',
  SMALL_BUSINESS = 'SMALL_BUSINESS',
  AGENCY = 'AGENCY',
  ENTERPRISE = 'ENTERPRISE'
}

export interface OnboardingMetadata {
  userType: UserType
  businessSize?: string
  industry?: string
  goals?: string[]
  experience?: ExperienceLevel
  referralSource?: string
  customizationPreferences?: CustomizationPrefs
}

export enum ExperienceLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED'
}

export interface CustomizationPrefs {
  theme?: string
  dashboard?: string
  notifications?: boolean
  tutorials?: boolean
}

// Welcome Sequence Types
export interface WelcomeSequence {
  id: string
  steps: WelcomeStep[]
  personalizations: PersonalizationData
  completedSteps: string[]
}

export interface WelcomeStep {
  id: string
  type: WelcomeStepType
  title: string
  content: string
  mediaUrl?: string
  actionLabel?: string
  actionUrl?: string
  duration?: number // auto-advance after X seconds
  interactive?: boolean
}

export enum WelcomeStepType {
  INTRO = 'INTRO',
  VIDEO = 'VIDEO',
  FEATURE_HIGHLIGHT = 'FEATURE_HIGHLIGHT',
  TESTIMONIAL = 'TESTIMONIAL',
  GOAL_SETTING = 'GOAL_SETTING',
  PERSONALIZATION = 'PERSONALIZATION'
}

export interface PersonalizationData {
  name?: string
  company?: string
  role?: string
  goals?: string[]
  interests?: string[]
  experience?: ExperienceLevel
  avatar?: string
}

// Account Setup Types
export interface AccountSetupData {
  profile: ProfileSetup
  workspace: WorkspaceSetup
  preferences: UserPreferences
  notifications: NotificationSettings
}

export interface ProfileSetup {
  firstName: string
  lastName: string
  email: string
  phone?: string
  timezone: string
  avatar?: string
  bio?: string
  website?: string
  linkedinProfile?: string
}

export interface WorkspaceSetup {
  name: string
  description?: string
  industry: string
  size: CompanySize
  logo?: string
  website?: string
  timezone: string
  currency: string
  branding?: WorkspaceBranding
}

export enum CompanySize {
  SOLO = 'SOLO',
  SMALL = 'SMALL', // 2-10
  MEDIUM = 'MEDIUM', // 11-50  
  LARGE = 'LARGE', // 51-200
  ENTERPRISE = 'ENTERPRISE' // 200+
}

export interface WorkspaceBranding {
  primaryColor?: string
  secondaryColor?: string
  logo?: string
  favicon?: string
}

export interface UserPreferences {
  language: string
  dateFormat: string
  timeFormat: string
  theme: ThemePreference
  dashboardLayout: DashboardLayout
  defaultView: DefaultView
}

export enum ThemePreference {
  LIGHT = 'LIGHT',
  DARK = 'DARK',
  SYSTEM = 'SYSTEM'
}

export enum DashboardLayout {
  COMPACT = 'COMPACT',
  COMFORTABLE = 'COMFORTABLE',
  SPACIOUS = 'SPACIOUS'
}

export enum DefaultView {
  DASHBOARD = 'DASHBOARD',
  CONTENT = 'CONTENT',
  CALENDAR = 'CALENDAR',
  ANALYTICS = 'ANALYTICS'
}

export interface NotificationSettings {
  email: EmailNotifications
  push: PushNotifications
  inApp: InAppNotifications
  sms?: SMSNotifications
}

export interface EmailNotifications {
  enabled: boolean
  marketing: boolean
  updates: boolean
  reports: boolean
  mentions: boolean
  frequency: NotificationFrequency
}

export interface PushNotifications {
  enabled: boolean
  posts: boolean
  mentions: boolean
  analytics: boolean
  team: boolean
}

export interface InAppNotifications {
  enabled: boolean
  sound: boolean
  desktop: boolean
  mobile: boolean
}

export interface SMSNotifications {
  enabled: boolean
  urgent: boolean
  reports: boolean
}

export enum NotificationFrequency {
  IMMEDIATE = 'IMMEDIATE',
  HOURLY = 'HOURLY', 
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY'
}

// Social Account Connection Types
export interface SocialAccountConnection {
  id: string
  platform: SocialPlatform
  accountId: string
  displayName: string
  username: string
  profilePicture?: string
  followerCount?: number
  connectionStatus: ConnectionStatus
  permissions: PlatformPermission[]
  connectedAt: Date
  lastSyncAt?: Date
  settings: ConnectionSettings
}

export enum SocialPlatform {
  FACEBOOK = 'FACEBOOK',
  INSTAGRAM = 'INSTAGRAM', 
  TWITTER = 'TWITTER',
  LINKEDIN = 'LINKEDIN',
  YOUTUBE = 'YOUTUBE',
  TIKTOK = 'TIKTOK',
  PINTEREST = 'PINTEREST'
}

export enum ConnectionStatus {
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR',
  EXPIRED = 'EXPIRED',
  PENDING = 'PENDING'
}

export enum PlatformPermission {
  READ_PROFILE = 'READ_PROFILE',
  PUBLISH_POSTS = 'PUBLISH_POSTS',
  READ_ANALYTICS = 'READ_ANALYTICS',
  MANAGE_COMMENTS = 'MANAGE_COMMENTS',
  READ_MESSAGES = 'READ_MESSAGES',
  MANAGE_ADS = 'MANAGE_ADS'
}

export interface ConnectionSettings {
  autoPost: boolean
  syncAnalytics: boolean
  syncComments: boolean
  postingSchedule?: PostingSchedule
  contentFilters?: ContentFilter[]
}

export interface PostingSchedule {
  enabled: boolean
  timezone: string
  schedule: WeeklySchedule
  bufferTime: number // minutes between posts
}

export interface WeeklySchedule {
  [key: string]: TimeSlot[] // 'monday', 'tuesday', etc.
}

export interface TimeSlot {
  hour: number
  minute: number
  enabled: boolean
}

export interface ContentFilter {
  type: FilterType
  value: string
  action: FilterAction
}

export enum FilterType {
  KEYWORD = 'KEYWORD',
  HASHTAG = 'HASHTAG',
  MENTION = 'MENTION',
  CONTENT_TYPE = 'CONTENT_TYPE'
}

export enum FilterAction {
  ALLOW = 'ALLOW',
  BLOCK = 'BLOCK',
  REVIEW = 'REVIEW'
}

// Guided Tour Types
export interface GuidedTour {
  id: string
  name: string
  description: string
  category: TourCategory
  steps: TourStep[]
  currentStepIndex: number
  isActive: boolean
  completedAt?: Date
  settings: TourSettings
}

export enum TourCategory {
  GETTING_STARTED = 'GETTING_STARTED',
  CONTENT_CREATION = 'CONTENT_CREATION',
  ANALYTICS = 'ANALYTICS',
  TEAM_MANAGEMENT = 'TEAM_MANAGEMENT',
  ADVANCED_FEATURES = 'ADVANCED_FEATURES'
}

export interface TourStep {
  id: string
  title: string
  content: string
  element?: string // CSS selector or element ID
  placement: TooltipPlacement
  showNext: boolean
  showPrev: boolean
  showSkip: boolean
  action?: TourAction
  validation?: StepValidation
}

export enum TooltipPlacement {
  TOP = 'TOP',
  BOTTOM = 'BOTTOM', 
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  CENTER = 'CENTER'
}

export interface TourAction {
  type: ActionType
  target?: string
  value?: any
  waitForCompletion?: boolean
}

export enum ActionType {
  CLICK = 'CLICK',
  NAVIGATE = 'NAVIGATE',
  FORM_FILL = 'FORM_FILL',
  WAIT = 'WAIT',
  CUSTOM = 'CUSTOM'
}

export interface StepValidation {
  type: ValidationType
  target: string
  expectedValue?: any
  timeout?: number
}

export enum ValidationType {
  ELEMENT_EXISTS = 'ELEMENT_EXISTS',
  ELEMENT_VISIBLE = 'ELEMENT_VISIBLE',
  FORM_COMPLETED = 'FORM_COMPLETED',
  API_CALL = 'API_CALL'
}

export interface TourSettings {
  autoStart: boolean
  pauseOnFocusLoss: boolean
  allowSkip: boolean
  showProgress: boolean
  overlay: boolean
  spotlightPadding: number
}

// Help & Tutorial System Types
export interface HelpContent {
  id: string
  title: string
  type: HelpContentType
  content: string
  mediaUrl?: string
  category: HelpCategory
  tags: string[]
  difficulty: DifficultyLevel
  estimatedReadTime: number
  lastUpdated: Date
  relatedTopics: string[]
  feedback?: ContentFeedback
}

export enum HelpContentType {
  ARTICLE = 'ARTICLE',
  VIDEO = 'VIDEO',
  TUTORIAL = 'TUTORIAL',
  FAQ = 'FAQ',
  GUIDE = 'GUIDE',
  TROUBLESHOOTING = 'TROUBLESHOOTING'
}

export enum HelpCategory {
  GETTING_STARTED = 'GETTING_STARTED',
  CONTENT_CREATION = 'CONTENT_CREATION',
  SOCIAL_ACCOUNTS = 'SOCIAL_ACCOUNTS',
  ANALYTICS = 'ANALYTICS',
  TEAM_COLLABORATION = 'TEAM_COLLABORATION',
  BILLING = 'BILLING',
  TROUBLESHOOTING = 'TROUBLESHOOTING',
  ADVANCED = 'ADVANCED'
}

export enum DifficultyLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE', 
  ADVANCED = 'ADVANCED'
}

export interface ContentFeedback {
  helpful: number
  notHelpful: number
  averageRating: number
  comments: FeedbackComment[]
}

export interface FeedbackComment {
  id: string
  userId: string
  content: string
  rating: number
  createdAt: Date
}

export interface Tutorial {
  id: string
  title: string
  description: string
  category: HelpCategory
  difficulty: DifficultyLevel
  estimatedTime: number
  steps: TutorialStep[]
  prerequisites?: string[]
  resources: TutorialResource[]
  completionTracking: CompletionTracking
}

export interface TutorialStep {
  id: string
  title: string
  content: string
  mediaUrl?: string
  codeExample?: string
  action?: TutorialAction
  validation?: TutorialValidation
  tips?: string[]
}

export interface TutorialAction {
  type: string
  description: string
  target?: string
  expectedResult: string
}

export interface TutorialValidation {
  type: string
  criteria: string
  errorMessage: string
}

export interface TutorialResource {
  id: string
  name: string
  type: ResourceType
  url: string
  description?: string
}

export enum ResourceType {
  DOCUMENT = 'DOCUMENT',
  VIDEO = 'VIDEO',
  TEMPLATE = 'TEMPLATE',
  TOOL = 'TOOL',
  EXTERNAL_LINK = 'EXTERNAL_LINK'
}

export interface CompletionTracking {
  totalSteps: number
  completedSteps: number
  startedAt?: Date
  completedAt?: Date
  progress: StepProgress[]
}

export interface StepProgress {
  stepId: string
  completedAt?: Date
  attempts: number
  timeSpent: number
}

// Onboarding Analytics Types
export interface OnboardingAnalytics {
  userId: string
  workspaceId: string
  flowId: string
  startedAt: Date
  completedAt?: Date
  currentStep: string
  completionPercentage: number
  timeSpent: number // in minutes
  stepAnalytics: StepAnalytics[]
  dropoffPoint?: string
  conversionFunnel: FunnelStep[]
  userBehavior: BehaviorMetrics
}

export interface StepAnalytics {
  stepId: string
  startedAt: Date
  completedAt?: Date
  timeSpent: number
  attempts: number
  skipped: boolean
  helpContentViewed: string[]
  errors?: ErrorEvent[]
}

export interface ErrorEvent {
  timestamp: Date
  type: string
  message: string
  step: string
  resolved: boolean
}

export interface FunnelStep {
  stepId: string
  entered: number
  completed: number
  dropoffRate: number
  averageTime: number
}

export interface BehaviorMetrics {
  clicks: number
  scrolls: number
  focusEvents: number
  idleTime: number
  backNavigation: number
  helpRequests: number
  searchQueries: string[]
}

// Progress Indicator Types
export interface ProgressIndicator {
  type: ProgressType
  currentValue: number
  maxValue: number
  label?: string
  showPercentage: boolean
  showSteps: boolean
  animated: boolean
  color?: string
  size: ProgressSize
}

export enum ProgressType {
  LINEAR = 'LINEAR',
  CIRCULAR = 'CIRCULAR',
  STEP = 'STEP',
  CHECKLIST = 'CHECKLIST'
}

export enum ProgressSize {
  SMALL = 'SMALL',
  MEDIUM = 'MEDIUM', 
  LARGE = 'LARGE'
}

// API Response Types
export interface OnboardingStateResponse {
  flow: OnboardingFlow
  analytics: OnboardingAnalytics
  availableTours: GuidedTour[]
  helpContent: HelpContent[]
}

export interface OnboardingUpdateRequest {
  stepId: string
  status: OnboardingStepStatus
  data?: any
  timeSpent?: number
}

export interface OnboardingUpdateResponse {
  success: boolean
  flow: OnboardingFlow
  nextStep?: OnboardingStep
  recommendations?: string[]
}