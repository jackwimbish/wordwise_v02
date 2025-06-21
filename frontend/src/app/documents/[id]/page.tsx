'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { TiptapEditor } from '@/components/editor/TiptapEditor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Navbar } from '@/components/navigation/Navbar'
import { Card } from '@/components/ui/card'

export default function DocumentPage() {
  const params = useParams()
  const router = useRouter()
  const documentId = params.id as string
  
  const {
    currentDocument,
    currentDocumentLoading,
    currentDocumentSaving,
    hasUnsavedChanges,
    loadCurrentDocument,
    saveCurrentDocument,
    updateCurrentDocumentContent,
    updateCurrentDocumentTitle,
    setCurrentDocument
  } = useAppStore()
  
  const [isTitleEditing, setIsTitleEditing] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const loadedDocumentId = useRef<string | null>(null)

  // Load document on mount
  useEffect(() => {
    if (documentId && documentId !== loadedDocumentId.current) {
      loadedDocumentId.current = documentId
      loadCurrentDocument(documentId)
    }
    
    // Cleanup on unmount
    return () => {
      setCurrentDocument(null)
      loadedDocumentId.current = null
    }
  }, [documentId, loadCurrentDocument, setCurrentDocument])

  // Update title value when document loads
  useEffect(() => {
    if (currentDocument) {
      setTitleValue(currentDocument.title)
    }
  }, [currentDocument])

  const handleTitleSave = () => {
    if (titleValue.trim() && titleValue !== currentDocument?.title) {
      updateCurrentDocumentTitle(titleValue.trim())
    }
    setIsTitleEditing(false)
  }

  const handleTitleCancel = () => {
    setTitleValue(currentDocument?.title || '')
    setIsTitleEditing(false)
  }

  const handleSave = async () => {
    await saveCurrentDocument()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave()
    } else if (e.key === 'Escape') {
      handleTitleCancel()
    }
  }

  // Auto-save functionality (optional - save every 30 seconds if there are changes)
  useEffect(() => {
    if (!hasUnsavedChanges) return

    const autoSaveTimer = setTimeout(() => {
      saveCurrentDocument()
    }, 30000) // 30 seconds

    return () => clearTimeout(autoSaveTimer)
  }, [hasUnsavedChanges, saveCurrentDocument])

  if (currentDocumentLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading document...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!currentDocument) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <Card className="p-8 text-center max-w-md mx-auto">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Document Not Found</h2>
            <p className="text-gray-600 mb-6">The document you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.</p>
            <Button onClick={() => router.push('/documents')}>
              Back to Documents
            </Button>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Document Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              {isTitleEditing ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={titleValue}
                    onChange={(e) => setTitleValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleTitleSave}
                    className="text-2xl font-bold border-none p-0 h-auto focus:ring-0 bg-transparent"
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={handleTitleSave}>
                      ✓
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleTitleCancel}>
                      ✕
                    </Button>
                  </div>
                </div>
              ) : (
                <h1 
                  className="text-3xl font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                  onClick={() => setIsTitleEditing(true)}
                  title="Click to edit title"
                >
                  {currentDocument.title}
                </h1>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              {hasUnsavedChanges && (
                <span className="text-sm text-orange-600 font-medium">
                  Unsaved changes
                </span>
              )}
              <Button 
                onClick={handleSave}
                disabled={currentDocumentSaving || !hasUnsavedChanges}
                className="min-w-[80px]"
              >
                {currentDocumentSaving ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    Saving...
                  </div>
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </div>
          
          <div className="text-sm text-gray-500">
            Last updated: {new Date(currentDocument.updated_at).toLocaleString()}
          </div>
        </div>

        {/* Editor */}
        <Card className="p-0 overflow-hidden">
          <TiptapEditor
            content={currentDocument.content}
            onUpdate={updateCurrentDocumentContent}
            placeholder="Start writing your document..."
          />
        </Card>
      </div>
    </div>
  )
} 