"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CheckCircle, XCircle, Mail, ArrowRight } from "lucide-react"
import { signIn } from "next-auth/react"

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [userData, setUserData] = useState<{ id: string; email: string; name: string } | null>(null)
  const [isSigningIn, setIsSigningIn] = useState(false)
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('No verification token provided')
      return
    }

    // Verify the email token
    const verifyEmail = async () => {
      try {
        const response = await fetch(`/api/auth/verify-email?token=${token}`, {
          method: 'GET',
        })

        const data = await response.json()

        if (response.ok) {
          setStatus('success')
          setMessage(data.message)
          setUserData(data.user)
        } else {
          setStatus('error')
          setMessage(data.message || 'Email verification failed')
        }
      } catch (error) {
        setStatus('error')
        setMessage('An error occurred while verifying your email')
      }
    }

    verifyEmail()
  }, [token])

  const handleSignIn = async () => {
    if (!userData) return

    setIsSigningIn(true)
    try {
      const result = await signIn('credentials', {
        email: userData.email,
        password: '', // We'll need to prompt for password or handle differently
        redirect: false,
      })

      if (result?.ok) {
        router.push('/dashboard')
      } else {
        // If auto sign-in fails, redirect to sign-in page with success message
        router.push('/auth/signin?verified=true')
      }
    } catch (error) {
      // On error, redirect to sign-in page
      router.push('/auth/signin?verified=true')
    } finally {
      setIsSigningIn(false)
    }
  }

  const handleResendVerification = async () => {
    if (!userData) return

    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userData.email
        }),
      })

      const data = await response.json()
      
      if (response.ok) {
        setMessage('New verification email sent! Please check your inbox.')
      } else {
        setMessage(data.message || 'Failed to send verification email')
      }
    } catch (error) {
      setMessage('An error occurred while sending verification email')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            {status === 'loading' && (
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {status === 'success' && (
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            )}
            {status === 'error' && (
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
            )}
          </div>
          <CardTitle className="text-2xl font-bold">
            {status === 'loading' && 'Verifying Email...'}
            {status === 'success' && 'Email Verified!'}
            {status === 'error' && 'Verification Failed'}
          </CardTitle>
          <CardDescription>
            {status === 'loading' && 'Please wait while we verify your email address'}
            {status === 'success' && 'Your email has been successfully verified'}
            {status === 'error' && 'We couldn\'t verify your email address'}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {message && (
            <Alert variant={status === 'error' ? 'destructive' : 'default'}>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          {status === 'success' && userData && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{userData.name}</p>
                    <p className="text-sm text-muted-foreground">{userData.email}</p>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => router.push('/auth/signin?verified=true')}
                className="w-full"
                disabled={isSigningIn}
              >
                {isSigningIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Continue to Sign In
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              {message.includes('expired') && (
                <Button
                  onClick={handleResendVerification}
                  variant="outline"
                  className="w-full"
                >
                  Send New Verification Email
                </Button>
              )}
              
              <Button
                onClick={() => router.push('/auth/signin')}
                variant="outline"
                className="w-full"
              >
                Go to Sign In
              </Button>
              
              <Button
                onClick={() => router.push('/auth/signup')}
                variant="ghost"
                className="w-full"
              >
                Create New Account
              </Button>
            </div>
          )}

          <div className="text-center text-sm">
            <Link
              href="/auth/signin"
              className="text-muted-foreground hover:text-primary"
            >
              ← Back to Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}