'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { TiptapEditor } from '@/components/editor/TiptapEditor'
import { ReadabilityScore } from '@/components/editor/ReadabilityScore'
import { PageCount } from '@/components/editor/PageCount'
import { RewriteSidebar } from '@/components/editor/RewriteSidebar'
import { ExportButton } from '@/components/editor/ExportButton'
import { PageCountSettings, DEFAULT_PAGE_SETTINGS } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Navbar } from '@/components/navigation/Navbar'
import { Card } from '@/components/ui/card'
import type { LengthRewriteResponse, RetryRewriteRequest } from '@/types'
import type { Editor } from '@tiptap/react'

export default function DocumentPage() {
  const params = useParams()
  const router = useRouter()
  const documentId = params.id as string
  const isNewDocument = documentId === 'new'
  
  const {
    currentDocument,
    currentDocumentLoading,
    currentDocumentSaving,
    hasUnsavedChanges,
    loadCurrentDocument,
    saveCurrentDocument,
    updateCurrentDocumentContent,
    updateCurrentDocumentTitle,
    setCurrentDocument,
    apiClient
  } = useAppStore()
  
  const [isTitleEditing, setIsTitleEditing] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null)
  const [readabilityText, setReadabilityText] = useState('')
  
  // Page settings state (shared between PageCount and RewriteSidebar)
  const [pageSettings, setPageSettings] = useState<PageCountSettings>(DEFAULT_PAGE_SETTINGS)
  
  // Store editor reference for real-time text access
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null)
  
  // Rewrite sidebar state
  const [rewriteResponse, setRewriteResponse] = useState<LengthRewriteResponse | null>(null)
  const [retryingParagraphs, setRetryingParagraphs] = useState<Set<number>>(new Set())
  const [dismissedParagraphs, setDismissedParagraphs] = useState<Set<number>>(new Set())
  const loadedDocumentId = useRef<string | null>(null)
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load document on mount or set up new document
  useEffect(() => {
    if (isNewDocument) {
      // Set up a new document without backend call
      setCurrentDocument({
        id: '', // Will be set after first save
        profile_id: '',
        title: 'Untitled Document',
        content: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      loadedDocumentId.current = 'new'
    } else if (documentId && documentId !== loadedDocumentId.current) {
      loadedDocumentId.current = documentId
      loadCurrentDocument(documentId)
    }
    
    // Cleanup on unmount
    return () => {
      setCurrentDocument(null)
      loadedDocumentId.current = null
    }
  }, [documentId, isNewDocument, loadCurrentDocument, setCurrentDocument])

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
    if (isNewDocument && currentDocument) {
      // Create new document in backend
      try {
        const newDocument = await apiClient.createDocument({
          title: currentDocument.title,
          content: currentDocument.content
        })
        
        // Only update metadata fields, preserve the current content in the editor
        setCurrentDocument({
          ...currentDocument, // Keep current content and title as-is
          id: newDocument.id,
          profile_id: newDocument.profile_id,
          updated_at: newDocument.updated_at,
          created_at: newDocument.created_at
        })
        
        // Update the URL to the new document ID
        router.replace(`/documents/${newDocument.id}`)
        
        // Update loaded document ID to prevent reloading
        loadedDocumentId.current = newDocument.id
      } catch (error) {
        console.error('Failed to create document:', error)
      }
    } else {
      // Update existing document
      await saveCurrentDocument()
    }
  }

  // Debounced auto-save function
  const debouncedAutoSave = useCallback(async () => {
    // Don't auto-save if there are no changes or if already saving
    if (!hasUnsavedChanges || currentDocumentSaving) {
      return
    }

    try {
      setIsAutoSaving(true)
      
      if (isNewDocument && currentDocument) {
        // Create new document in backend via auto-save
        const newDocument = await apiClient.createDocument({
          title: currentDocument.title,
          content: currentDocument.content
        })
        
        // Only update metadata fields, preserve the current content in the editor
        setCurrentDocument({
          ...currentDocument, // Keep current content and title as-is
          id: newDocument.id,
          profile_id: newDocument.profile_id,
          updated_at: newDocument.updated_at,
          created_at: newDocument.created_at
        })
        
        // Update the URL to the new document ID
        router.replace(`/documents/${newDocument.id}`)
        
        // Update loaded document ID to prevent reloading
        loadedDocumentId.current = newDocument.id
      } else {
        // Update existing document
        await saveCurrentDocument()
      }
      
      setLastAutoSave(new Date())
    } catch (error) {
      console.error('Auto-save failed:', error)
    } finally {
      setIsAutoSaving(false)
    }
  }, [hasUnsavedChanges, currentDocumentSaving, isNewDocument, currentDocument, apiClient, setCurrentDocument, router, saveCurrentDocument])

  // Trigger auto-save when content changes
  useEffect(() => {
    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }

    // Don't auto-save if there are no unsaved changes
    if (!hasUnsavedChanges) {
      return
    }

    // Set new timeout for auto-save (3 seconds after last change to let user finish typing)
    autoSaveTimeoutRef.current = setTimeout(() => {
      debouncedAutoSave()
    }, 3000)

    // Cleanup function
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [hasUnsavedChanges, debouncedAutoSave])

  // Cleanup auto-save timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave()
    } else if (e.key === 'Escape') {
      handleTitleCancel()
    }
  }

  // Rewrite sidebar handlers
  const handleAcceptRewrite = useCallback((paragraphId: number, rewrittenText: string, originalText?: string) => {
    console.log(`Accepting rewrite for paragraph ${paragraphId}`, { rewrittenText, originalText })
    
    // Use the TipTap editor to handle HTML content replacement
    if (editorInstance && originalText && rewrittenText) {
      const currentHTML = editorInstance.getHTML()
      
      // Try to replace the original HTML with the rewritten HTML
      // Both originalText and rewrittenText should now be HTML content
      const updatedHTML = currentHTML.replace(originalText, rewrittenText)
      
      if (updatedHTML !== currentHTML) {
        // Set the new HTML content in the editor
        editorInstance.commands.setContent(updatedHTML, false)
        
        // Update the document content with the new HTML
        updateCurrentDocumentContent(updatedHTML)
        
        // Update readability text
        setTimeout(() => {
          const currentText = editorInstance.getText()
          setReadabilityText(currentText)
          console.log('✅ Successfully updated document content with HTML formatting preserved')
        }, 50)
      } else {
        console.warn('⚠️ Could not find paragraph to update in document HTML')
        
        // Fallback: try to find and replace by extracting text content
        const parser = new DOMParser()
        const originalDoc = parser.parseFromString(originalText, 'text/html')
        const rewrittenDoc = parser.parseFromString(rewrittenText, 'text/html')
        const originalTextContent = originalDoc.body.textContent || ''
        const rewrittenTextContent = rewrittenDoc.body.textContent || ''
        
        if (originalTextContent && rewrittenTextContent) {
          const currentContent = currentDocument?.content || ''
          const updatedContent = currentContent.replace(originalTextContent, rewrittenTextContent)
          
          if (updatedContent !== currentContent) {
            updateCurrentDocumentContent(updatedContent)
            console.log('✅ Fallback: Updated document content using text replacement')
          }
        }
      }
    } else if (currentDocument && originalText) {
      // Fallback for when editor is not available - use the old text-based approach
      const currentContent = currentDocument.content
      
      // Extract text content if we have HTML
      let originalTextContent = originalText
      let rewrittenTextContent = rewrittenText
      
      if (originalText.includes('<') && originalText.includes('>')) {
        const parser = new DOMParser()
        const originalDoc = parser.parseFromString(originalText, 'text/html')
        const rewrittenDoc = parser.parseFromString(rewrittenText, 'text/html')
        originalTextContent = originalDoc.body.textContent || originalText
        rewrittenTextContent = rewrittenDoc.body.textContent || rewrittenText
      }
      
      const updatedContent = currentContent.replace(originalTextContent, rewrittenTextContent)
      
      if (updatedContent !== currentContent) {
        updateCurrentDocumentContent(updatedContent)
        console.log('✅ Fallback: Updated document content without editor')
      } else {
        console.warn('⚠️ Could not find paragraph to update in document')
      }
    }
    
    // Remove this paragraph from the suggestions
    if (rewriteResponse) {
      const updatedRewrites = rewriteResponse.paragraph_rewrites.filter(
        rewrite => rewrite.paragraph_id !== paragraphId
      )
      
      setRewriteResponse({
        ...rewriteResponse,
        paragraph_rewrites: updatedRewrites
      })
    }
  }, [rewriteResponse, currentDocument, updateCurrentDocumentContent, editorInstance])

  const handleRetryRewrite = useCallback(async (paragraphId: number, retryRequest: RetryRewriteRequest) => {
    setRetryingParagraphs(prev => new Set(prev).add(paragraphId))

    try {
      const response = await apiClient.retryRewrite(retryRequest)
      
              // Update the rewrite response with the new suggestion
        if (rewriteResponse) {
          const updatedRewrites = rewriteResponse.paragraph_rewrites.map(rewrite => {
          if (rewrite.paragraph_id === paragraphId) {
            return {
              ...rewrite,
              rewritten_text: response.rewritten_text,
              rewritten_length: response.rewritten_length
            }
          }
          return rewrite
        })
        
        setRewriteResponse({
          ...rewriteResponse,
          paragraph_rewrites: updatedRewrites
        })
      }
      
    } catch (error) {
      console.error('Failed to retry rewrite:', error)
      alert('Failed to get alternative suggestion. Please try again.')
    } finally {
      setRetryingParagraphs(prev => {
        const newSet = new Set(prev)
        newSet.delete(paragraphId)
        return newSet
      })
    }
  }, [apiClient, rewriteResponse])

  const handleDismissRewrite = useCallback((paragraphId: number) => {
    setDismissedParagraphs(prev => new Set(prev).add(paragraphId))
  }, [])

  // Get visible suggestions (not dismissed)
  const visibleSuggestions = rewriteResponse?.paragraph_rewrites.filter(
    rewrite => !dismissedParagraphs.has(rewrite.paragraph_id)
  ) || []



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
      
      <div className="flex min-h-[calc(100vh-4rem)]">
        {/* Left Panel - Analysis Tools */}
        <div className="w-80 flex-shrink-0 p-4 bg-white/50 border-r border-gray-200">
          <div className="sticky top-4 space-y-4">
            <ReadabilityScore text={readabilityText} />
            <PageCount 
              text={readabilityText} 
              settings={pageSettings}
              onSettingsChange={setPageSettings}
            />
          </div>
        </div>
        
        {/* Main Content */}
        <div className="flex-1 px-4 py-8 max-w-4xl mx-auto">
        {/* Document Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1 group">
              {isTitleEditing ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={titleValue}
                    onChange={(e) => setTitleValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleTitleSave}
                    className="text-2xl font-bold border-2 border-blue-300 rounded-lg px-3 py-2 h-auto focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
                    placeholder="Enter document title..."
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={handleTitleSave} className="text-green-600 hover:text-green-700 hover:bg-green-50">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleTitleCancel} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </Button>
                  </div>
                </div>
              ) : (
                <div 
                  className="flex items-center gap-2 cursor-pointer p-2 -ml-2 rounded-lg hover:bg-blue-50 transition-all duration-200"
                  onClick={() => setIsTitleEditing(true)}
                  title="Click to edit title"
                >
                  <h1 className="text-3xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {currentDocument.title}
                  </h1>
                  <div className="opacity-60 group-hover:opacity-100 transition-opacity duration-200">
                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              {/* Auto-save status indicator */}
              {isAutoSaving && (
                <span className="text-sm text-blue-600 font-medium flex items-center gap-1">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                  Auto-saving...
                </span>
              )}
              {/* Unsaved changes indicator */}
              {hasUnsavedChanges && !isAutoSaving && (
                <span className="text-sm text-orange-600 font-medium">
                  {isNewDocument ? 'New document - unsaved' : 'Unsaved changes'}
                </span>
              )}
              {/* Last auto-save time */}
              {lastAutoSave && !hasUnsavedChanges && !isAutoSaving && (
                <span className="text-sm text-green-600 font-medium">
                  Auto-saved {lastAutoSave.toLocaleTimeString()}
                </span>
              )}
              
              <ExportButton 
                title={currentDocument.title}
                content={currentDocument.content}
                disabled={currentDocumentSaving || isAutoSaving}
              />
              
              <Button 
                onClick={handleSave}
                disabled={currentDocumentSaving || isAutoSaving || !hasUnsavedChanges}
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
          
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {isNewDocument 
                ? 'New document - not saved yet'
                : `Last updated: ${new Date(currentDocument.updated_at).toLocaleString()}`
              }
            </div>
            {!isTitleEditing && (
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-xs text-blue-500 font-medium">
                Click title to edit
              </div>
            )}
          </div>
        </div>

          {/* Editor */}
          <Card className="p-0 overflow-hidden">
            <TiptapEditor
              content={currentDocument.content}
              onUpdate={updateCurrentDocumentContent}
              onReadabilityTextChange={setReadabilityText}
              onEditorReady={setEditorInstance}
              placeholder="Start writing your document..."
              documentId={currentDocument.id}
            />
          </Card>
        </div>

        {/* Right Panel - Rewrite Tools */}
        <RewriteSidebar
          rewriteResponse={rewriteResponse}
          visibleSuggestions={visibleSuggestions}
          retryingParagraphs={retryingParagraphs}
          onAcceptRewrite={handleAcceptRewrite}
          onRetryRewrite={handleRetryRewrite}
          onDismissRewrite={handleDismissRewrite}
          unit={(rewriteResponse?.unit as 'words' | 'characters') || 'words'}
          mode={(rewriteResponse?.mode as 'shorten' | 'lengthen') || 'shorten'}
          documentId={currentDocument?.id}
          documentContent={readabilityText}
          editorInstance={editorInstance}
          onRewriteResponse={setRewriteResponse}
          onDismissedParagraphs={setDismissedParagraphs}
          pageSettings={pageSettings}
        />
      </div>
    </div>
  )
} 