'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { useTabVisibility } from '@/lib/hooks'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/dialog'
import { FileUpload } from '@/components/ui/file-upload'
import { Navbar } from '@/components/navigation/Navbar'
import { formatDistanceToNow } from 'date-fns'

export default function DocumentsPage() {
  const router = useRouter()
  const { 
    user, 
    documents, 
    documentsLoading, 
    loadDocuments,
    deleteDocument,
    importDocument
  } = useAppStore()

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<{ id: string; title: string } | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  
  // Keep track of whether we've loaded documents for this user
  const hasLoadedForUser = useRef<string | null>(null)

  // Stable reference to loadDocuments - only depend on user.id to prevent unnecessary re-renders
  const loadDocumentsStable = useCallback(() => {
    if (user) {
      loadDocuments()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, loadDocuments]) // Only depend on user.id, not the entire user object

  // Handle tab visibility with automatic refresh - only depend on user.id
  const handleTabVisible = useCallback(() => {
    if (user && hasLoadedForUser.current === user.id) {
      loadDocuments()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, loadDocuments])

  useTabVisibility(handleTabVisible, 5000) // 5 second threshold

  // Load documents when user changes (but not on every user object recreation)
  useEffect(() => {
    if (user && hasLoadedForUser.current !== user.id) {
      hasLoadedForUser.current = user.id
      loadDocumentsStable()
    } else if (!user) {
      hasLoadedForUser.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, loadDocumentsStable]) // Only depend on user.id to prevent unnecessary re-renders

  const handleCreateDocument = () => {
    if (!user) return
    
    // Navigate to new document page without creating in backend yet
    router.push('/documents/new')
  }

  const handleDeleteClick = (doc: { id: string; title: string }) => {
    setDocumentToDelete(doc)
    setDeleteConfirmOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!documentToDelete) return
    
    try {
      await deleteDocument(documentToDelete.id)
      setDocumentToDelete(null)
    } catch (error) {
      console.error('Failed to delete document:', error)
      // You could add a toast notification here for error handling
    }
  }

  const handleFileImport = async (file: File) => {
    if (!user) return
    
    setIsImporting(true)
    try {
      const document = await importDocument(file)
      // Navigate to the newly created document
      router.push(`/documents/${document.id}`)
    } catch (error) {
      console.error('Failed to import document:', error)
      alert('Failed to import document. Please try again.')
    } finally {
      setIsImporting(false)
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
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  My Documents
                </h1>
                <p className="text-gray-600 mt-1">
                  Manage your writing projects with AI-powered assistance
                </p>
              </div>
              <div className="flex gap-3">
                <Button onClick={handleCreateDocument} size="lg">
                  + New Document
                </Button>
                <div className="min-w-[200px]">
                  <FileUpload 
                    onFileSelect={handleFileImport}
                    disabled={isImporting}
                  />
                </div>
              </div>
            </div>
            
            {isImporting && (
              <div className="mt-4 flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Importing document...</span>
              </div>
            )}
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
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <Button onClick={handleCreateDocument}>
                    Create Your First Document
                  </Button>
                  <span className="text-gray-400">or</span>
                  <div className="min-w-[250px]">
                    <FileUpload 
                      onFileSelect={handleFileImport}
                      disabled={isImporting}
                      className="border-solid"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Documents Grid */}
          {!documentsLoading && documents.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {documents.map((doc) => (
                <Card 
                  key={doc.id} 
                  className="hover:shadow-lg transition-shadow cursor-pointer flex flex-col"
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
                  <CardContent className="flex flex-col h-full">
                    {/* Content Preview - Fixed height container */}
                    <div className="mb-4 flex-1 min-h-[2.5rem]">
                      {doc.content_preview ? (
                        <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                          {doc.content_preview}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-400 italic">
                          No preview available
                        </p>
                      )}
                    </div>
                    
                    {/* Footer - Always positioned at bottom */}
                    <div className="flex justify-between items-center mt-auto">
                      <span className="text-sm text-gray-500">
                        Created {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
                      </span>
                      <div className="flex gap-2">
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteClick({ id: doc.id, title: doc.title })
                          }}
                          className="text-red-600 hover:text-red-700 hover:border-red-300"
                        >
                          <svg 
                            className="w-4 h-4" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path 
                              strokeLinecap="round" 
                              strokeLinejoin="round" 
                              strokeWidth={2} 
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                            />
                          </svg>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={handleDeleteConfirm}
        title="Delete Document"
        description={
          documentToDelete 
            ? `Are you sure you want to delete "${documentToDelete.title}"? This action cannot be undone.`
            : 'Are you sure you want to delete this document? This action cannot be undone.'
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />
    </div>
  )
} 