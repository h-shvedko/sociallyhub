"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CalendarDays } from "lucide-react"

interface Profile {
  name: string | null
  image: string | null
  email: string | null
  createdAt: string | null
}

export default function ProfilePage() {
  const { data: session, update: updateSession } = useSession()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [image, setImage] = useState("")

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const res = await fetch("/api/user/profile")
        if (!res.ok) throw new Error("Failed to load profile")
        const data: Profile = await res.json()
        if (!active) return
        setProfile(data)
        setName(data.name ?? "")
        setImage(data.image ?? "")
      } catch {
        if (active) toast.error("Could not load your profile")
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  const startEdit = () => {
    setName(profile?.name ?? "")
    setImage(profile?.image ?? "")
    setIsEditing(true)
  }

  const cancelEdit = () => {
    setName(profile?.name ?? "")
    setImage(profile?.image ?? "")
    setIsEditing(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim().length === 0) {
      toast.error("Name cannot be empty")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), image: image.trim() || null }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to update profile")
      }
      const updated: Profile = await res.json()
      setProfile(updated)
      setIsEditing(false)
      // Reflect the new display name/avatar in the NextAuth session.
      try {
        await updateSession({ name: updated.name, image: updated.image })
      } catch {
        // Session refresh is best-effort; the saved value is already persisted.
      }
      toast.success("Profile updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  const displayName = profile?.name || session?.user?.name || "User"
  const displayEmail = profile?.email || session?.user?.email || ""
  const displayImage = profile?.image || session?.user?.image || ""
  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">
          Manage your account settings and personal information.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Profile Header */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start space-x-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={displayImage} />
                <AvatarFallback className="text-lg">
                  {displayName.charAt(0) || displayEmail.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <div>
                  <h2 className="text-2xl font-semibold">{displayName}</h2>
                  <p className="text-muted-foreground">{displayEmail}</p>
                </div>
                {memberSince && (
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">
                      <CalendarDays className="w-3 h-3 mr-1" />
                      Member since {memberSince}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>
                  Update your display name and avatar.
                </CardDescription>
              </div>
              {!isEditing && (
                <Button variant="default" onClick={startEdit} disabled={loading}>
                  Edit Profile
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!isEditing || saving}
                    maxLength={200}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" value={displayEmail} disabled readOnly />
                  <p className="text-xs text-muted-foreground">
                    Email changes require re-verification and are not available here.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="image">Avatar URL</Label>
                  <Input
                    id="image"
                    value={image}
                    onChange={(e) => setImage(e.target.value)}
                    disabled={!isEditing || saving}
                    placeholder="https://example.com/avatar.png"
                  />
                </div>

                {isEditing && (
                  <div className="flex justify-end space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={cancelEdit}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving ? "Saving…" : "Save Changes"}
                    </Button>
                  </div>
                )}
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
