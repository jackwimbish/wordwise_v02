'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import type { HealthCheck } from '@/types'

export default function HomePage() {
  const [healthStatus, setHealthStatus] = useState<HealthCheck | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const apiClient = useAppStore((state) => state.apiClient)

  useEffect(() => {
    async function checkHealth() {
      try {
        setLoading(true)
        setError(null)
        const health = await apiClient.healthCheck()
        setHealthStatus(health)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect to backend')
      } finally {
        setLoading(false)
      }
    }

    checkHealth()
  }, [apiClient])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Welcome to <span className="text-blue-600">WordWise</span>
          </h1>
          <p className="text-xl text-gray-600 mb-12">
            Your AI-powered writing assistant for real-time suggestions and improvements
          </p>

          {/* Health Check Status */}
          <div className="bg-white rounded-lg shadow-md p-8 mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              Backend Connection Status
            </h2>
            
            {loading && (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Connecting to backend...</span>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Connection Failed</h3>
                    <p className="mt-1 text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {healthStatus && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">Backend Connected</h3>
                    <p className="mt-1 text-sm text-green-700">
                      Status: <span className="font-medium">{healthStatus.status}</span>
                    </p>
                    <p className="text-sm text-green-700">
                      Message: {healthStatus.message}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Call to Action */}
          <div className="space-y-4">
            <a
              href="/auth"
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
            >
              Get Started
              <svg className="ml-2 -mr-1 w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </a>
            
            <p className="text-sm text-gray-500">
              Ready to improve your writing with AI-powered suggestions?
            </p>
          </div>
        </div>
      </main>
    </div>
  )
} 