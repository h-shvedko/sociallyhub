"use client"

import { useEffect, useMemo, useState } from "react"
import { signOut } from "next-auth/react"
import { useDictionary } from "@/hooks/use-dictionary"
import { useSettings } from "@/contexts/settings-context"
import { useToast } from "@/hooks/use-toast"
import { TIMEZONES } from "@/lib/utils/date-time"
import { LanguageSelector } from "@/components/ui/language-selector"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ToastContainer } from "@/components/ui/toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PageLoader } from "@/components/ui/loading-spinner"
import {
  Settings as SettingsIcon,
  Bell,
  Shield,
  Palette,
  Mail,
  Smartphone,
  Monitor,
  Moon,
  Sun,
  Eye,
  Download,
  Trash2,
  AlertTriangle,
  Loader2,
} from "lucide-react"

// ---- Static config -------------------------------------------------------

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
    icon: <SettingsIcon className="w-4 h-4" />,
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Configure how you receive notifications",
    icon: <Bell className="w-4 h-4" />,
  },
  {
    id: "appearance",
    title: "Appearance",
    description: "Customize the look and feel",
    icon: <Palette className="w-4 h-4" />,
  },
  {
    id: "privacy",
    title: "Privacy & Security",
    description: "Manage your privacy and security settings",
    icon: <Shield className="w-4 h-4" />,
  },
]

const DATE_FORMAT_OPTIONS = [
  { value: "MM/dd/yyyy", label: "MM/DD/YYYY (US)" },
  { value: "dd/MM/yyyy", label: "DD/MM/YYYY (UK)" },
  { value: "yyyy-MM-dd", label: "YYYY-MM-DD (ISO)" },
]

const TIME_FORMAT_OPTIONS = [
  { value: "12h", label: "12-hour (AM/PM)" },
  { value: "24h", label: "24-hour" },
]

const WEEK_START_OPTIONS = [
  { value: "sunday", label: "Sunday" },
  { value: "monday", label: "Monday" },
]

const DEFAULT_VIEW_OPTIONS = [
  { value: "overview", label: "Overview" },
  { value: "posts", label: "Posts" },
  { value: "analytics", label: "Analytics" },
  { value: "inbox", label: "Inbox" },
]

// The 16 notification types (see ADR-0010). label = human-readable.
const NOTIFICATION_TYPES: { key: string; label: string }[] = [
  { key: "APPROVAL_REQUESTED", label: "Approval requested" },
  { key: "APPROVAL_GRANTED", label: "Approval granted" },
  { key: "APPROVAL_DENIED", label: "Approval denied" },
  { key: "PUBLISH_SUCCESS", label: "Publish succeeded" },
  { key: "PUBLISH_FAILED", label: "Publish failed" },
  { key: "TOKEN_EXPIRING", label: "Token expiring" },
  { key: "TOKEN_EXPIRED", label: "Token expired" },
  { key: "INBOX_ASSIGNMENT", label: "Inbox assignment" },
  { key: "SLA_BREACH", label: "SLA breach" },
  { key: "REPORT_READY", label: "Report ready" },
  { key: "TEAM_INVITATION", label: "Team invitation" },
  { key: "MENTION", label: "Mention" },
  { key: "COMMENT", label: "Comment" },
  { key: "LIKE", label: "Like" },
  { key: "SHARE", label: "Share" },
  { key: "FOLLOW", label: "Follow" },
]

const NOTIF_CHANNELS = [
  { key: "email", label: "Email" },
  { key: "push", label: "Push" },
  { key: "inApp", label: "In-app" },
] as const

const DND_DAYS = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
  { key: "sunday", label: "Sun" },
]

// ---- Local draft types ---------------------------------------------------

type ChannelPrefs = { email: boolean; push: boolean; inApp: boolean }
type PreferencesMap = Record<string, ChannelPrefs>

interface GeneralDraft {
  timezone: string
  dateFormat: string
  timeFormat: string
  weekStartDay: string
  defaultView: string
}

interface AppearanceDraft {
  fontScale: string
  compactMode: boolean
}

interface PrivacyDraft {
  profileVisible: boolean
  activityVisible: boolean
  analyticsOptOut: boolean
}

interface NotifDraft {
  preferences: PreferencesMap
  emailEnabled: boolean
  pushEnabled: boolean
  inAppEnabled: boolean
  soundEnabled: boolean
  dailyDigest: boolean
  weeklyDigest: boolean
  monthlyDigest: boolean
  digestTime: string
  dndEnabled: boolean
  dndStartTime: string
  dndEndTime: string
  dndDays: string[]
}

function normalizeChannel(raw: unknown): ChannelPrefs {
  const obj = (raw ?? {}) as Record<string, unknown>
  return {
    email: obj.email === true,
    push: obj.push === true,
    inApp: obj.inApp === true,
  }
}

// ---- Page ----------------------------------------------------------------

export default function SettingsPage() {
  const { t } = useDictionary()
  const {
    userSettings,
    notificationPreferences,
    loading,
    saving,
    updateUserSettings,
    updateNotificationPreferences,
  } = useSettings()
  const { toasts, toast, removeToast } = useToast()

  const [activeSection, setActiveSection] = useState("general")

  // Drafts (initialised from context once data loads).
  const [general, setGeneral] = useState<GeneralDraft | null>(null)
  const [appearance, setAppearance] = useState<AppearanceDraft | null>(null)
  const [privacy, setPrivacy] = useState<PrivacyDraft | null>(null)
  const [notif, setNotif] = useState<NotifDraft | null>(null)

  // Delete-account dialog state.
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState("")
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  // Sync user-settings-backed drafts from context.
  useEffect(() => {
    if (!userSettings) return
    setGeneral({
      timezone: userSettings.timezone,
      dateFormat: userSettings.dateFormat,
      timeFormat: userSettings.timeFormat,
      weekStartDay: userSettings.weekStartDay,
      defaultView: userSettings.defaultView,
    })
    setAppearance({
      fontScale: userSettings.fontScale,
      compactMode: userSettings.compactMode,
    })
    setPrivacy({
      profileVisible: userSettings.profileVisible,
      activityVisible: userSettings.activityVisible,
      analyticsOptOut: userSettings.analyticsOptOut,
    })
  }, [userSettings])

  // Sync notification-preferences draft from context.
  useEffect(() => {
    if (!notificationPreferences) return
    const rawPrefs = (notificationPreferences.preferences ?? {}) as Record<
      string,
      unknown
    >
    const prefs: PreferencesMap = {}
    for (const { key } of NOTIFICATION_TYPES) {
      prefs[key] = normalizeChannel(rawPrefs[key])
    }
    setNotif({
      preferences: prefs,
      emailEnabled: notificationPreferences.emailEnabled,
      pushEnabled: notificationPreferences.pushEnabled,
      inAppEnabled: notificationPreferences.inAppEnabled,
      soundEnabled: notificationPreferences.soundEnabled,
      dailyDigest: notificationPreferences.dailyDigest,
      weeklyDigest: notificationPreferences.weeklyDigest,
      monthlyDigest: notificationPreferences.monthlyDigest,
      digestTime: notificationPreferences.digestTime || "09:00",
      dndEnabled: notificationPreferences.dndEnabled,
      dndStartTime: notificationPreferences.dndStartTime || "22:00",
      dndEndTime: notificationPreferences.dndEndTime || "08:00",
      dndDays: Array.isArray(notificationPreferences.dndDays)
        ? (notificationPreferences.dndDays as string[])
        : [],
    })
  }, [notificationPreferences])

  const themeValue = userSettings?.theme ?? "system"

  // ---- Save handlers -----------------------------------------------------

  const handleThemeChange = async (theme: string) => {
    try {
      await updateUserSettings({ theme: theme as "light" | "dark" | "system" })
      toast.success("Theme updated")
    } catch {
      toast.error("Failed to update theme")
    }
  }

  const saveGeneral = async () => {
    if (!general) return
    try {
      await updateUserSettings(general)
      toast.success("General settings saved")
    } catch {
      toast.error("Failed to save settings")
    }
  }

  const saveAppearance = async () => {
    if (!appearance) return
    try {
      await updateUserSettings(appearance)
      toast.success("Appearance saved")
    } catch {
      toast.error("Failed to save appearance")
    }
  }

  const savePrivacy = async () => {
    if (!privacy) return
    try {
      await updateUserSettings(privacy)
      toast.success("Privacy settings saved")
    } catch {
      toast.error("Failed to save privacy settings")
    }
  }

  const saveNotifications = async () => {
    if (!notif) return
    try {
      await updateNotificationPreferences({
        // Cast preferences to the Json field type expected by Prisma.
        preferences: notif.preferences as unknown as never,
        emailEnabled: notif.emailEnabled,
        pushEnabled: notif.pushEnabled,
        inAppEnabled: notif.inAppEnabled,
        soundEnabled: notif.soundEnabled,
        dailyDigest: notif.dailyDigest,
        weeklyDigest: notif.weeklyDigest,
        monthlyDigest: notif.monthlyDigest,
        digestTime: notif.digestTime,
        dndEnabled: notif.dndEnabled,
        dndStartTime: notif.dndStartTime,
        dndEndTime: notif.dndEndTime,
        dndDays: notif.dndDays,
      })
      toast.success("Notification preferences saved")
    } catch {
      toast.error("Failed to save notification preferences")
    }
  }

  // ---- Danger zone -------------------------------------------------------

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch("/api/user/export")
      if (!res.ok) {
        throw new Error("Export failed")
      }
      const blob = await res.blob()
      // Derive a filename from Content-Disposition when the server sets one.
      let filename = "sociallyhub-account-export.json"
      const disposition = res.headers.get("Content-Disposition")
      const match = disposition?.match(/filename="?([^"]+)"?/i)
      if (match?.[1]) filename = match[1]

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success("Your data export has been downloaded")
    } catch {
      toast.error("Failed to export your data")
    } finally {
      setExporting(false)
    }
  }

  const handleDelete = async () => {
    setDeleteError(null)
    if (deleteConfirm !== "DELETE") {
      setDeleteError('Please type "DELETE" to confirm.')
      return
    }
    if (!deletePassword) {
      setDeleteError("Please enter your account password.")
      return
    }
    setDeleting(true)
    try {
      const res = await fetch("/api/user/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: deletePassword,
          confirm: deleteConfirm,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setDeleteError(data?.error || "Failed to delete account.")
        setDeleting(false)
        return
      }
      // Account deleted — sign out and redirect home.
      await signOut({ callbackUrl: "/" })
    } catch {
      setDeleteError("Failed to delete account. Please try again.")
      setDeleting(false)
    }
  }

  // ---- Renderers ---------------------------------------------------------

  const renderGeneral = () => {
    if (!general) return null
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">General Settings</h3>
          <p className="text-sm text-muted-foreground">
            Configure your basic account preferences
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={general.timezone}
                onValueChange={(value) =>
                  setGeneral({ ...general, timezone: value })
                }
              >
                <SelectTrigger id="timezone">
                  <SelectValue placeholder="Select a timezone" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label} ({tz.offset})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">
                {t("settings.language", "Language")}
              </Label>
              <LanguageSelector />
              <p className="text-xs text-muted-foreground">
                {t(
                  "settings.languageNote",
                  "Interface language with automatic translation support"
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateFormat">Date Format</Label>
              <Select
                value={general.dateFormat}
                onValueChange={(value) =>
                  setGeneral({ ...general, dateFormat: value })
                }
              >
                <SelectTrigger id="dateFormat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_FORMAT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeFormat">Time Format</Label>
              <Select
                value={general.timeFormat}
                onValueChange={(value) =>
                  setGeneral({ ...general, timeFormat: value })
                }
              >
                <SelectTrigger id="timeFormat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_FORMAT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="weekStartDay">Week Starts On</Label>
              <Select
                value={general.weekStartDay}
                onValueChange={(value) =>
                  setGeneral({ ...general, weekStartDay: value })
                }
              >
                <SelectTrigger id="weekStartDay">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEK_START_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultView">Default View</Label>
              <Select
                value={general.defaultView}
                onValueChange={(value) =>
                  setGeneral({ ...general, defaultView: value })
                }
              >
                <SelectTrigger id="defaultView">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_VIEW_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <SaveBar onSave={() => void saveGeneral()} saving={saving} />
      </div>
    )
  }

  const renderNotifications = () => {
    if (!notif) return null
    const setChannel = (type: string, channel: keyof ChannelPrefs, value: boolean) => {
      setNotif({
        ...notif,
        preferences: {
          ...notif.preferences,
          [type]: { ...notif.preferences[type], [channel]: value },
        },
      })
    }
    const toggleDay = (day: string, checked: boolean) => {
      const set = new Set(notif.dndDays)
      if (checked) set.add(day)
      else set.delete(day)
      setNotif({ ...notif, dndDays: Array.from(set) })
    }

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Notification Preferences</h3>
          <p className="text-sm text-muted-foreground">
            Choose how and when you want to be notified. These are enforced at
            delivery time.
          </p>
        </div>

        {/* Global channel toggles */}
        <div className="space-y-3">
          <h4 className="font-medium">Channels</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ToggleRow
              icon={<Mail className="w-4 h-4" />}
              title="Email"
              description="Master switch for email notifications"
              checked={notif.emailEnabled}
              onCheckedChange={(v) => setNotif({ ...notif, emailEnabled: v })}
            />
            <ToggleRow
              icon={<Smartphone className="w-4 h-4" />}
              title="Push"
              description="Master switch for push notifications"
              checked={notif.pushEnabled}
              onCheckedChange={(v) => setNotif({ ...notif, pushEnabled: v })}
            />
            <ToggleRow
              icon={<Bell className="w-4 h-4" />}
              title="In-app"
              description="Master switch for in-app notifications"
              checked={notif.inAppEnabled}
              onCheckedChange={(v) => setNotif({ ...notif, inAppEnabled: v })}
            />
            <ToggleRow
              icon={<Bell className="w-4 h-4" />}
              title="Sounds"
              description="Play a sound for new notifications"
              checked={notif.soundEnabled}
              onCheckedChange={(v) => setNotif({ ...notif, soundEnabled: v })}
            />
          </div>
        </div>

        <Separator />

        {/* Per-type matrix */}
        <div className="space-y-3">
          <h4 className="font-medium">By notification type</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left font-medium py-2 pr-4">Type</th>
                  {NOTIF_CHANNELS.map((c) => (
                    <th
                      key={c.key}
                      className="text-center font-medium py-2 px-3 w-20"
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {NOTIFICATION_TYPES.map((type) => (
                  <tr key={type.key} className="border-b last:border-0">
                    <td className="py-2 pr-4">{type.label}</td>
                    {NOTIF_CHANNELS.map((c) => (
                      <td key={c.key} className="text-center py-2 px-3">
                        <Checkbox
                          checked={notif.preferences[type.key]?.[c.key] ?? false}
                          onCheckedChange={(v) =>
                            setChannel(type.key, c.key, v === true)
                          }
                          aria-label={`${type.label} ${c.label}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Separator />

        {/* Digests */}
        <div className="space-y-3">
          <h4 className="font-medium">Digests</h4>
          <ToggleRow
            title="Daily digest"
            description="A daily summary email"
            checked={notif.dailyDigest}
            onCheckedChange={(v) => setNotif({ ...notif, dailyDigest: v })}
          />
          <ToggleRow
            title="Weekly digest"
            description="A weekly summary email"
            checked={notif.weeklyDigest}
            onCheckedChange={(v) => setNotif({ ...notif, weeklyDigest: v })}
          />
          <ToggleRow
            title="Monthly digest"
            description="A monthly summary email"
            checked={notif.monthlyDigest}
            onCheckedChange={(v) => setNotif({ ...notif, monthlyDigest: v })}
          />
          <div className="flex items-center gap-3">
            <Label htmlFor="digestTime" className="w-40">
              Digest delivery time
            </Label>
            <Input
              id="digestTime"
              type="time"
              className="w-40"
              value={notif.digestTime}
              onChange={(e) =>
                setNotif({ ...notif, digestTime: e.target.value })
              }
            />
          </div>
        </div>

        <Separator />

        {/* Do Not Disturb */}
        <div className="space-y-3">
          <h4 className="font-medium">Do Not Disturb</h4>
          <ToggleRow
            title="Enable Do Not Disturb"
            description="Suppress notifications during the window below"
            checked={notif.dndEnabled}
            onCheckedChange={(v) => setNotif({ ...notif, dndEnabled: v })}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Label htmlFor="dndStart" className="w-40">
              Quiet hours
            </Label>
            <Input
              id="dndStart"
              type="time"
              className="w-32"
              value={notif.dndStartTime}
              disabled={!notif.dndEnabled}
              onChange={(e) =>
                setNotif({ ...notif, dndStartTime: e.target.value })
              }
            />
            <span className="text-muted-foreground">to</span>
            <Input
              id="dndEnd"
              type="time"
              className="w-32"
              value={notif.dndEndTime}
              disabled={!notif.dndEnabled}
              onChange={(e) =>
                setNotif({ ...notif, dndEndTime: e.target.value })
              }
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {DND_DAYS.map((d) => {
              const active = notif.dndDays.includes(d.key)
              return (
                <Button
                  key={d.key}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  disabled={!notif.dndEnabled}
                  onClick={() => toggleDay(d.key, !active)}
                >
                  {d.label}
                </Button>
              )
            })}
          </div>
        </div>

        <SaveBar onSave={() => void saveNotifications()} saving={saving} />
      </div>
    )
  }

  const renderAppearance = () => {
    if (!appearance) return null
    return (
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
                {
                  value: "system",
                  label: "System",
                  icon: <Monitor className="w-4 h-4" />,
                },
              ].map((th) => (
                <Button
                  key={th.value}
                  variant={themeValue === th.value ? "default" : "outline"}
                  className="flex items-center gap-2"
                  disabled={saving}
                  onClick={() => void handleThemeChange(th.value)}
                >
                  {th.icon}
                  {th.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Theme changes apply and save instantly.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fontScale">Font size</Label>
            <Select
              value={appearance.fontScale}
              onValueChange={(value) =>
                setAppearance({ ...appearance, fontScale: value })
              }
            >
              <SelectTrigger id="fontScale" className="w-full md:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="large">Large</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ToggleRow
            title="Compact mode"
            description="Use a more compact interface layout"
            checked={appearance.compactMode}
            onCheckedChange={(v) =>
              setAppearance({ ...appearance, compactMode: v })
            }
          />
        </div>

        <SaveBar onSave={() => void saveAppearance()} saving={saving} />
      </div>
    )
  }

  const renderPrivacy = () => {
    if (!privacy) return null
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Privacy & Security</h3>
          <p className="text-sm text-muted-foreground">
            Manage your privacy settings and account data
          </p>
        </div>

        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Privacy
          </h4>

          <ToggleRow
            title="Profile visible"
            description="Allow other members of your workspaces to see your profile"
            checked={privacy.profileVisible}
            onCheckedChange={(v) =>
              setPrivacy({ ...privacy, profileVisible: v })
            }
          />
          <ToggleRow
            title="Activity visible"
            description="Show your recent activity to workspace members"
            checked={privacy.activityVisible}
            onCheckedChange={(v) =>
              setPrivacy({ ...privacy, activityVisible: v })
            }
          />
          <ToggleRow
            title="Opt out of usage analytics"
            description="Stop sharing anonymous product usage data"
            checked={privacy.analyticsOptOut}
            onCheckedChange={(v) =>
              setPrivacy({ ...privacy, analyticsOptOut: v })
            }
          />

          <SaveBar onSave={() => void savePrivacy()} saving={saving} />
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-4 h-4" />
            Danger Zone
          </h4>

          <div className="space-y-3 p-4 border border-red-200 rounded-lg bg-red-50 dark:bg-red-950/20 dark:border-red-900">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">Export data</p>
                <p className="text-sm text-muted-foreground">
                  Download all your data in JSON format
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleExport()}
                disabled={exporting}
              >
                {exporting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Export
              </Button>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-red-600">Delete account</p>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account and all data
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setDeleteError(null)
                  setDeletePassword("")
                  setDeleteConfirm("")
                  setDeleteOpen(true)
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderContent = () => {
    switch (activeSection) {
      case "general":
        return renderGeneral()
      case "notifications":
        return renderNotifications()
      case "appearance":
        return renderAppearance()
      case "privacy":
        return renderPrivacy()
      default:
        return renderGeneral()
    }
  }

  const ready = useMemo(
    () => !loading && !!userSettings && !!notificationPreferences,
    [loading, userSettings, notificationPreferences]
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences.
        </p>
      </div>

      {!ready ? (
        <div className="py-24">
          <PageLoader text="Loading your settings..." />
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-6">
          {/* Settings Navigation */}
          <div className="md:w-64 shrink-0">
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
                        <p className="text-xs opacity-80">
                          {section.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Settings Content */}
          <div className="flex-1 min-w-0">
            <Card>
              <CardContent className="p-6">{renderContent()}</CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Delete account confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete account</DialogTitle>
            <DialogDescription>
              This permanently deletes your account and all associated data.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="deletePassword">Account password</Label>
              <Input
                id="deletePassword"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deleteConfirm">
                Type <span className="font-mono font-semibold">DELETE</span> to
                confirm
              </Label>
              <Input
                id="deleteConfirm"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
              />
            </div>
            {deleteError && (
              <p className="text-sm text-red-600">{deleteError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={
                deleting ||
                deleteConfirm !== "DELETE" ||
                deletePassword.length === 0
              }
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete my account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  )
}

// ---- Small presentational helpers ---------------------------------------

function SaveBar({
  onSave,
  saving,
}: {
  onSave: () => void
  saving: boolean
}) {
  return (
    <>
      <Separator />
      <div className="flex justify-end">
        <Button onClick={() => void onSave()} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </>
  )
}

function ToggleRow({
  icon,
  title,
  description,
  checked,
  onCheckedChange,
}: {
  icon?: React.ReactNode
  title: string
  description: string
  checked: boolean
  onCheckedChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-start gap-2">
        {icon && <span className="mt-0.5">{icon}</span>}
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}
