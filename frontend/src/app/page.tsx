'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { AuthForm } from '@/components/auth/AuthForm'

export default function HomePage() {
  const { user, isLoading } = useAppStore()
  const router = useRouter()

  // Redirect authenticated users to documents page
  useEffect(() => {
    if (user && !isLoading) {
      router.push('/documents')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <main className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-lg text-gray-600">Loading...</span>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Welcome to <span className="text-blue-600">WordWise</span>
          </h1>
          <p className="text-xl text-gray-600 mb-12">
            From first draft to final count - AI that understands your publishing limits
          </p>

          <div className="flex justify-center">
            <AuthForm />
          </div>
        </div>
      </main>
    </div>
  )
} 