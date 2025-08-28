"use client"

import { useState } from "react"
import { useDictionary } from "@/hooks/use-dictionary"
import { useLocale } from "@/contexts/locale-context"
import { LanguageSelector } from "@/components/ui/language-selector"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { 
  Settings as SettingsIcon, 
  Bell, 
  Shield, 
  Palette, 
  Globe, 
  Clock,
  Mail,
  Smartphone,
  Monitor,
  Moon,
  Sun,
  Eye,
  Download,
  Trash2,
  AlertTriangle
} from "lucide-react"

interface SettingsSection {
  id: string
  title: string
  description: string
  icon: React.ReactNode
}

const settingsSections: SettingsSection[] = [
  {
    id: "general",
    title: "General",
    description: "Basic account and workspace settings",
    icon: <SettingsIcon className="w-4 h-4" />
  },
  {
    id: "notifications", 
    title: "Notifications",
    description: "Configure how you receive notifications",
    icon: <Bell className="w-4 h-4" />
  },
  {
    id: "appearance",
    title: "Appearance", 
    description: "Customize the look and feel",
    icon: <Palette className="w-4 h-4" />
  },
  {
    id: "privacy",
    title: "Privacy & Security",
    description: "Manage your privacy and security settings",
    icon: <Shield className="w-4 h-4" />
  }
]

export default function SettingsPage() {
  const { t, isLoading } = useDictionary()
  const { locale } = useLocale()
  const [activeSection, setActiveSection] = useState("general")
  const [settings, setSettings] = useState({
    // General
    timezone: "UTC-5",
    language: "en",
    dateFormat: "MM/DD/YYYY",
    
    // Notifications
    emailNotifications: true,
    pushNotifications: true,
    postReminders: true,
    weeklyReports: true,
    mentionAlerts: true,
    
    // Appearance
    theme: "system",
    compactMode: false,
    showAvatars: true,
    
    // Privacy
    profileVisibility: "workspace",
    analyticsSharing: false,
    twoFactor: false
  })

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const renderGeneralSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">General Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure your basic account preferences
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select value={settings.timezone} onValueChange={(value) => updateSetting("timezone", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UTC-8">Pacific Time (UTC-8)</SelectItem>
                <SelectItem value="UTC-5">Eastern Time (UTC-5)</SelectItem>
                <SelectItem value="UTC+0">GMT (UTC+0)</SelectItem>
                <SelectItem value="UTC+1">Central European (UTC+1)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="language">{t('settings.language', 'Language')}</Label>
            <LanguageSelector />
            <p className="text-xs text-muted-foreground">
              {t('settings.languageNote', 'Interface language with automatic translation support')}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dateFormat">Date Format</Label>
          <Select value={settings.dateFormat} onValueChange={(value) => updateSetting("dateFormat", value)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
              <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
              <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )

  const renderNotificationSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Notification Preferences</h3>
        <p className="text-sm text-muted-foreground">
          Choose how and when you want to be notified
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Email Notifications
          </h4>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Email notifications</p>
                <p className="text-sm text-muted-foreground">Receive notifications via email</p>
              </div>
              <Switch 
                checked={settings.emailNotifications}
                onCheckedChange={(checked) => updateSetting("emailNotifications", checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Weekly reports</p>
                <p className="text-sm text-muted-foreground">Get weekly performance summaries</p>
              </div>
              <Switch 
                checked={settings.weeklyReports}
                onCheckedChange={(checked) => updateSetting("weeklyReports", checked)}
              />
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <Smartphone className="w-4 h-4" />
            Push Notifications
          </h4>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Push notifications</p>
                <p className="text-sm text-muted-foreground">Receive push notifications</p>
              </div>
              <Switch 
                checked={settings.pushNotifications}
                onCheckedChange={(checked) => updateSetting("pushNotifications", checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Post reminders</p>
                <p className="text-sm text-muted-foreground">Get reminded about scheduled posts</p>
              </div>
              <Switch 
                checked={settings.postReminders}
                onCheckedChange={(checked) => updateSetting("postReminders", checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Mention alerts</p>
                <p className="text-sm text-muted-foreground">Get notified when you're mentioned</p>
              </div>
              <Switch 
                checked={settings.mentionAlerts}
                onCheckedChange={(checked) => updateSetting("mentionAlerts", checked)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderAppearanceSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Appearance</h3>
        <p className="text-sm text-muted-foreground">
          Customize how the interface looks and feels
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Theme</Label>
          <div className="flex gap-2">
            {[
              { value: "light", label: "Light", icon: <Sun className="w-4 h-4" /> },
              { value: "dark", label: "Dark", icon: <Moon className="w-4 h-4" /> },
              { value: "system", label: "System", icon: <Monitor className="w-4 h-4" /> }
            ].map((theme) => (
              <Button
                key={theme.value}
                variant={settings.theme === theme.value ? "default" : "outline"}
                className="flex items-center gap-2"
                onClick={() => updateSetting("theme", theme.value)}
              >
                {theme.icon}
                {theme.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Compact mode</p>
            <p className="text-sm text-muted-foreground">Use a more compact interface layout</p>
          </div>
          <Switch 
            checked={settings.compactMode}
            onCheckedChange={(checked) => updateSetting("compactMode", checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Show avatars</p>
            <p className="text-sm text-muted-foreground">Display user avatars throughout the interface</p>
          </div>
          <Switch 
            checked={settings.showAvatars}
            onCheckedChange={(checked) => updateSetting("showAvatars", checked)}
          />
        </div>
      </div>
    </div>
  )

  const renderPrivacySettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Privacy & Security</h3>
        <p className="text-sm text-muted-foreground">
          Manage your privacy settings and account security
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Privacy
          </h4>
          
          <div className="space-y-2">
            <Label htmlFor="profileVisibility">Profile visibility</Label>
            <Select value={settings.profileVisibility} onValueChange={(value) => updateSetting("profileVisibility", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public - visible to everyone</SelectItem>
                <SelectItem value="workspace">Workspace only</SelectItem>
                <SelectItem value="private">Private - only me</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Analytics sharing</p>
              <p className="text-sm text-muted-foreground">Help improve the product by sharing anonymous usage data</p>
            </div>
            <Switch 
              checked={settings.analyticsSharing}
              onCheckedChange={(checked) => updateSetting("analyticsSharing", checked)}
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Security
          </h4>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Two-factor authentication</p>
              <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={settings.twoFactor ? "secondary" : "outline"}>
                {settings.twoFactor ? "Enabled" : "Disabled"}
              </Badge>
              <Button variant="outline" size="sm">
                {settings.twoFactor ? "Disable" : "Enable"}
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-4 h-4" />
            Danger Zone
          </h4>
          
          <div className="space-y-3 p-4 border border-red-200 rounded-lg bg-red-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Export data</p>
                <p className="text-sm text-muted-foreground">Download all your data in JSON format</p>
              </div>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-red-600">Delete account</p>
                <p className="text-sm text-muted-foreground">Permanently delete your account and all data</p>
              </div>
              <Button variant="destructive" size="sm">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderContent = () => {
    switch (activeSection) {
      case "general": return renderGeneralSettings()
      case "notifications": return renderNotificationSettings()
      case "appearance": return renderAppearanceSettings()
      case "privacy": return renderPrivacySettings()
      default: return renderGeneralSettings()
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences.
        </p>
      </div>

      <div className="flex gap-6">
        {/* Settings Navigation */}
        <div className="w-64 shrink-0">
          <Card>
            <CardContent className="p-4">
              <nav className="space-y-1">
                {settingsSections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-lg transition-colors ${
                      activeSection === section.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    }`}
                  >
                    {section.icon}
                    <div>
                      <p className="font-medium">{section.title}</p>
                      <p className="text-xs opacity-80">{section.description}</p>
                    </div>
                  </button>
                ))}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Settings Content */}
        <div className="flex-1">
          <Card>
            <CardContent className="p-6">
              {renderContent()}
              <Separator className="my-6" />
              <div className="flex justify-end">
                <Button>Save Changes</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}