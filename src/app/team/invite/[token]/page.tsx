'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { 
  CheckCircle, 
  XCircle, 
  Mail, 
  Building, 
  Calendar, 
  Shield,
  User,
  Edit3,
  BarChart3,
  Crown,
  Loader2
} from 'lucide-react'

interface InvitationData {
  email: string
  role: string
  workspaceName: string
  invitedBy: string
  invitedByEmail: string
  createdAt: string
}

export default function TeamInvitationPage() {
  const params = useParams()
  const router = useRouter()
  const [invitation, setInvitation] = useState<InvitationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [response, setResponse] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  const token = params.token as string

  useEffect(() => {
    if (token) {
      fetchInvitation()
    }
  }, [token])

  const fetchInvitation = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/team/invitations/${token}`)
      
      if (response.ok) {
        const data = await response.json()
        setInvitation(data.invitation)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to load invitation')
      }
    } catch (err) {
      console.error('Error fetching invitation:', err)
      setError('Failed to load invitation')
    } finally {
      setLoading(false)
    }
  }

  const handleResponse = async (action: 'accept' | 'decline') => {
    try {
      setResponding(true)
      const response = await fetch(`/api/team/invitations/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action })
      })

      const result = await response.json()

      if (response.ok) {
        setResponse({ type: 'success', message: result.message })
        
        if (action === 'accept' && result.redirectUrl) {
          setTimeout(() => {
            router.push(result.redirectUrl)
          }, 2000)
        }
      } else {
        setResponse({ type: 'error', message: result.error || `Failed to ${action} invitation` })
      }
    } catch (err) {
      console.error(`Error ${action}ing invitation:`, err)
      setResponse({ type: 'error', message: `Failed to ${action} invitation` })
    } finally {
      setResponding(false)
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'OWNER': return <Crown className="h-5 w-5 text-yellow-500" />
      case 'ADMIN': return <Shield className="h-5 w-5 text-red-500" />
      case 'PUBLISHER': return <Edit3 className="h-5 w-5 text-green-500" />
      case 'ANALYST': return <BarChart3 className="h-5 w-5 text-blue-500" />
      case 'CLIENT_VIEWER': return <User className="h-5 w-5 text-gray-500" />
      default: return <User className="h-5 w-5 text-gray-500" />
    }
  }

  const getRoleDescription = (role: string) => {
    switch (role) {
      case 'OWNER': return 'Full access to all features and settings'
      case 'ADMIN': return 'Manage team members and content'
      case 'PUBLISHER': return 'Create and publish content'
      case 'ANALYST': return 'View analytics and generate reports'
      case 'CLIENT_VIEWER': return 'Limited access to client reports'
      default: return 'Team member'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading invitation...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-red-600">Invalid Invitation</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">{error}</p>
            <p className="text-sm text-muted-foreground">
              This invitation may have expired or already been used. Please contact the person who invited you for a new invitation.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (response) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            {response.type === 'success' ? (
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            ) : (
              <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            )}
            <CardTitle className={response.type === 'success' ? 'text-green-600' : 'text-red-600'}>
              {response.type === 'success' ? 'Success!' : 'Error'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">{response.message}</p>
            {response.type === 'success' && (
              <p className="text-sm text-muted-foreground mt-2">
                You will be redirected to the dashboard shortly...
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Team Invitation</CardTitle>
          <p className="text-muted-foreground">
            You've been invited to join a workspace on SociallyHub
          </p>
        </CardHeader>
        
        {invitation && (
          <CardContent className="space-y-6">
            {/* Workspace Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Building className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{invitation.workspaceName}</h3>
                  <div className="flex items-center space-x-2 mt-1">
                    {getRoleIcon(invitation.role)}
                    <span className="font-medium">{invitation.role}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {getRoleDescription(invitation.role)}
                  </p>
                </div>
              </div>
            </div>

            {/* Invitation Details */}
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Invited Email</p>
                  <p className="text-sm text-muted-foreground">{invitation.email}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Avatar className="h-4 w-4">
                  <AvatarFallback className="text-xs">
                    {invitation.invitedBy.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">Invited by</p>
                  <p className="text-sm text-muted-foreground">{invitation.invitedBy}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Invited on</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(invitation.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-3 pt-4">
              <Button
                onClick={() => handleResponse('decline')}
                variant="outline"
                disabled={responding}
                className="flex-1"
              >
                {responding ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Decline
              </Button>
              <Button
                onClick={() => handleResponse('accept')}
                disabled={responding}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {responding ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Accept & Join
              </Button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
              <p className="text-sm text-blue-800">
                <strong>What happens next?</strong><br />
                If you accept this invitation, you'll be added to the <strong>{invitation.workspaceName}</strong> workspace 
                and will be able to access it from your SociallyHub dashboard. If you don't have an account yet, 
                one will be created for you.
              </p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}