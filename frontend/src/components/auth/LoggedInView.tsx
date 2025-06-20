'use client'

import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function LoggedInView() {
  const { user, profile, signOut } = useAppStore()

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-green-600">Welcome to WordWise!</CardTitle>
          <CardDescription>
            You are successfully logged in
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Authentication Successful</h3>
                <div className="mt-2 text-sm text-green-700">
                  <p><strong>Email:</strong> {user?.email}</p>
                  {profile?.display_name && (
                    <p><strong>Name:</strong> {profile.display_name}</p>
                  )}
                  <p><strong>User ID:</strong> {user?.id}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center space-y-4">
            <p className="text-sm text-gray-600">
              🎉 Your account is ready! Start creating and managing your documents.
            </p>
            <Button 
              onClick={() => window.location.href = '/documents'}
              className="w-full"
            >
              Go to My Documents
            </Button>
          </div>

          <Button 
            onClick={handleSignOut}
            variant="outline" 
            className="w-full"
          >
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
} 