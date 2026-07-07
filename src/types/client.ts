// Client Management Types
export interface Client {
  id: string
  workspaceId: string
  name: string
  email: string
  phone?: string
  company?: string
  industry?: string
  website?: string
  logo?: string
  status: ClientStatus
  billingInfo?: ClientBillingInfo
  branding?: ClientBranding
  settings?: ClientSettings
  contractDetails?: ContractDetails
  onboardingStatus: OnboardingStatus
  createdAt: Date
  updatedAt: Date
  lastContactDate?: Date
  assignedUserId?: string
  tags?: string[]
  notes?: string
}

export enum ClientStatus {
  PROSPECT = 'PROSPECT',
  ACTIVE = 'ACTIVE',
  ON_HOLD = 'ON_HOLD',
  CHURNED = 'CHURNED',
  ARCHIVED = 'ARCHIVED'
}

export enum OnboardingStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  STALLED = 'STALLED'
}

export interface ClientBillingInfo {
  billingEmail?: string
  billingAddress?: Address
  paymentMethod?: PaymentMethod
  billingCycle: BillingCycle
  contractValue: number
  currency: string
  nextBillingDate?: Date
  paymentTerms: number // days
  taxId?: string
}

export interface Address {
  street: string
  city: string
  state: string
  zipCode: string
  country: string
}

export enum PaymentMethod {
  CREDIT_CARD = 'CREDIT_CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CHECK = 'CHECK',
  PAYPAL = 'PAYPAL',
  STRIPE = 'STRIPE'
}

export enum BillingCycle {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUAL = 'ANNUAL',
  ONE_TIME = 'ONE_TIME'
}

export interface ClientBranding {
  primaryColor?: string
  secondaryColor?: string
  logo?: string
  favicon?: string
  customCSS?: string
  whiteLabel: boolean
  customDomain?: string
  brandGuidelines?: BrandGuidelines
}

export interface BrandGuidelines {
  fonts?: string[]
  colorPalette?: string[]
  logoUsage?: string
  voiceAndTone?: string
  imagery?: string
  doAndDonts?: string[]
}

export interface ClientSettings {
  timeZone: string
  dateFormat: string
  currency: string
  language: string
  notificationPreferences: NotificationPreferences
  reportingPreferences: ReportingPreferences
  privacySettings: PrivacySettings
}

export interface NotificationPreferences {
  email: boolean
  sms: boolean
  push: boolean
  webhooks: boolean
  frequency: NotificationFrequency
  quietHours?: QuietHours
}

export enum NotificationFrequency {
  REAL_TIME = 'REAL_TIME',
  HOURLY = 'HOURLY',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY'
}

export interface QuietHours {
  enabled: boolean
  startTime: string
  endTime: string
  timeZone: string
}

export interface ReportingPreferences {
  frequency: ReportFrequency
  format: ReportFormat[]
  metrics: string[]
  customDashboard: boolean
  autoEmail: boolean
  recipients?: string[]
}

export enum ReportFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY'
}

export enum ReportFormat {
  PDF = 'PDF',
  EXCEL = 'EXCEL',
  CSV = 'CSV',
  DASHBOARD_LINK = 'DASHBOARD_LINK'
}

export interface PrivacySettings {
  dataRetention: number // days
  shareAnalytics: boolean
  allowDataExport: boolean
  gdprCompliant: boolean
  cookieConsent: boolean
}

export interface ContractDetails {
  startDate: Date
  endDate?: Date
  renewalDate?: Date
  contractType: ContractType
  serviceLevel: ServiceLevel
  included: ServiceIncludes
  customTerms?: string
  signedBy?: string
  signedDate?: Date
  documentUrl?: string
}

export enum ContractType {
  MONTHLY = 'MONTHLY',
  ANNUAL = 'ANNUAL',
  PROJECT_BASED = 'PROJECT_BASED',
  RETAINER = 'RETAINER'
}

export enum ServiceLevel {
  BASIC = 'BASIC',
  STANDARD = 'STANDARD',
  PREMIUM = 'PREMIUM',
  ENTERPRISE = 'ENTERPRISE',
  CUSTOM = 'CUSTOM'
}

export interface ServiceIncludes {
  socialAccounts: number
  monthlyPosts: number
  teamMembers: number
  analyticsReports: boolean
  prioritySupport: boolean
  customBranding: boolean
  whiteLabel: boolean
  apiAccess: boolean
  advancedFeatures: string[]
}

// Client Communication Types
export interface ClientCommunication {
  id: string
  clientId: string
  type: CommunicationType
  subject: string
  content: string
  status: CommunicationStatus
  priority: CommunicationPriority
  channel: CommunicationChannel
  senderId: string
  recipientEmails: string[]
  scheduledDate?: Date
  sentDate?: Date
  readDate?: Date
  responseDate?: Date
  attachments?: CommunicationAttachment[]
  tags?: string[]
  followUpDate?: Date
  createdAt: Date
  updatedAt: Date
}

export enum CommunicationType {
  EMAIL = 'EMAIL',
  MEETING = 'MEETING',
  CALL = 'CALL',
  PROPOSAL = 'PROPOSAL',
  INVOICE = 'INVOICE',
  REPORT = 'REPORT',
  UPDATE = 'UPDATE',
  NOTIFICATION = 'NOTIFICATION'
}

export enum CommunicationStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  SENT = 'SENT',
  READ = 'READ',
  RESPONDED = 'RESPONDED',
  FAILED = 'FAILED'
}

export enum CommunicationPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export enum CommunicationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PHONE = 'PHONE',
  VIDEO_CALL = 'VIDEO_CALL',
  IN_PERSON = 'IN_PERSON',
  SLACK = 'SLACK',
  WHATSAPP = 'WHATSAPP'
}

export interface CommunicationAttachment {
  id: string
  filename: string
  fileType: string
  fileSize: number
  url: string
}

// NOTE (ADR-0020/ADR-0024): the phantom ClientRole / ClientPermissionType /
// ClientPermission / ClientRestriction types were deleted here — they never
// matched the Prisma schema (client portal access is the real WorkspaceRole
// CLIENT_VIEWER scoped via UserWorkspace.clientId).

// Client Stats and Analytics
// Only real, DB-derived fields (ADR-0023). Fabricated revenue, industry/service-level,
// satisfaction, retention/churn, onboarding, response-time and growth/LTV figures were
// removed from /api/clients/stats rather than re-invented — SociallyHub does not store
// that data yet.
export interface ClientStats {
  totalClients: number
  activeClients: number
  prospectClients: number
  recentClients: number // new clients in the last 30 days
  engagementRate: number // % of clients with any active social/campaign/post
}

// API Request/Response Types
export interface CreateClientRequest {
  name: string
  email: string
  phone?: string
  company?: string
  industry?: string
  website?: string
  assignedUserId?: string
  tags?: string[]
  notes?: string
  contractDetails?: Partial<ContractDetails>
  billingInfo?: Partial<ClientBillingInfo>
}

export interface UpdateClientRequest extends Partial<CreateClientRequest> {
  status?: ClientStatus
  onboardingStatus?: OnboardingStatus
  branding?: Partial<ClientBranding>
  settings?: Partial<ClientSettings>
}

export interface ClientListResponse {
  clients: Client[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ClientStatsResponse extends ClientStats {}

export interface ClientFilters {
  status?: ClientStatus[]
  onboardingStatus?: OnboardingStatus[]
  industry?: string[]
  assignedUserId?: string[]
  tags?: string[]
  search?: string
  dateRange?: {
    startDate: Date
    endDate: Date
  }
}

// Onboarding Types
export interface OnboardingStep {
  id: string
  title: string
  description: string
  status: OnboardingStepStatus
  order: number
  required: boolean
  completedDate?: Date
  assignedUserId?: string
  notes?: string
  documents?: OnboardingDocument[]
}

export enum OnboardingStepStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  SKIPPED = 'SKIPPED',
  BLOCKED = 'BLOCKED'
}

export interface OnboardingDocument {
  id: string
  title: string
  description?: string
  fileUrl: string
  fileType: string
  required: boolean
  uploadedDate?: Date
  uploadedBy?: string
}

export interface OnboardingTemplate {
  id: string
  name: string
  description: string
  industry?: string
  serviceLevel?: ServiceLevel
  steps: OnboardingStep[]
  estimatedDuration: number // days
  createdAt: Date
  updatedAt: Date
}