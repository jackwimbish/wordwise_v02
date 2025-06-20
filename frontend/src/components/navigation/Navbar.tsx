'use client'

import Link from 'next/link'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'

export function Navbar() {
  const { user, profile, signOut } = useAppStore()

  if (!user) return null

  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/'
  }

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex-shrink-0">
              <span className="text-2xl font-bold text-blue-600">WordWise</span>
            </Link>
            <div className="ml-10 flex items-baseline space-x-4">
              <Link
                href="/documents"
                className="text-gray-900 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                My Documents
              </Link>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-700">
              Welcome, {profile?.display_name || user.email?.split('@')[0] || 'User'}!
            </span>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
} 