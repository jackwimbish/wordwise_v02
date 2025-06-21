'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Navbar } from '@/components/navigation/Navbar'
import { formatDistanceToNow } from 'date-fns'

export default function DocumentsPage() {
  const router = useRouter()
  const { 
    user, 
    documents, 
    documentsLoading, 
    documentsLoaded,
    loadDocuments,
    apiClient 
  } = useAppStore()

  useEffect(() => {
    if (user && !documentsLoaded) {
      loadDocuments()
    }
  }, [user, documentsLoaded, loadDocuments]) // Load documents only once per user session

  const handleCreateDocument = async () => {
    if (!user) return
    
    try {
      const newDocument = await apiClient.createDocument({
        title: 'Untitled Document',
        content: ''
      })
      
      // Navigate directly to the new document
      router.push(`/documents/${newDocument.id}`)
    } catch (error) {
      console.error('Failed to create document:', error)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <main className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Please sign in to access your documents
            </h1>
            <Button onClick={() => window.location.href = '/'}>
              Go to Login
            </Button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  My Documents
                </h1>
                <p className="text-gray-600 mt-1">
                  Manage your writing projects with AI-powered assistance
                </p>
              </div>
              <Button onClick={handleCreateDocument} size="lg">
                + New Document
              </Button>
            </div>
          </div>

          {/* Loading State */}
          {documentsLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading documents...</span>
            </div>
          )}

          {/* Empty State */}
          {!documentsLoading && documents.length === 0 && (
            <Card className="text-center py-16">
              <CardContent>
                <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No documents yet
                </h3>
                <p className="text-gray-600 mb-6">
                  Create your first document to start writing with AI assistance
                </p>
                <Button onClick={handleCreateDocument}>
                  Create Your First Document
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Documents Grid */}
          {!documentsLoading && documents.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {documents.map((doc) => (
                <Card 
                  key={doc.id} 
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => router.push(`/documents/${doc.id}`)}
                >
                  <CardHeader>
                    <CardTitle className="text-lg truncate">
                      {doc.title}
                    </CardTitle>
                    <CardDescription>
                      Last updated {formatDistanceToNow(new Date(doc.updated_at), { addSuffix: true })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">
                        Created {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
                      </span>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/documents/${doc.id}`)
                        }}
                      >
                        Open
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
} 