'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAppStore } from '@/lib/store'
import type { DocumentVersion, Document } from '@/types'
import { Clock, History, RotateCcw, Eye } from 'lucide-react'

interface VersionHistoryProps {
  documentId: string
  currentDocument: Document
  onDocumentUpdated: (document: Document) => void
  trigger?: React.ReactNode
}

export function VersionHistory({ 
  documentId, 
  currentDocument, 
  onDocumentUpdated,
  trigger 
}: VersionHistoryProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [versions, setVersions] = useState<DocumentVersion[]>([])
  const [selectedVersion, setSelectedVersion] = useState<DocumentVersion | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [versionToRestore, setVersionToRestore] = useState<DocumentVersion | null>(null)
  const [previewContent, setPreviewContent] = useState<string>('')
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { apiClient } = useAppStore()

  const loadVersions = useCallback(async () => {
    if (!apiClient) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await apiClient.getDocumentVersions(documentId)
      setVersions(response.versions)
    } catch (err) {
      console.error('Failed to load versions:', err)
      setError('Failed to load version history')
    } finally {
      setIsLoading(false)
    }
  }, [apiClient, documentId])

  // Load versions when sheet opens
  useEffect(() => {
    if (isOpen && documentId) {
      loadVersions()
    }
  }, [isOpen, documentId, loadVersions])

  const handlePreviewVersion = async (version: DocumentVersion) => {
    if (!apiClient) return
    
    setSelectedVersion(version)
    setPreviewContent(version.content)
    setIsPreviewMode(true)
  }

  const handleRestoreClick = (version: DocumentVersion) => {
    setVersionToRestore(version)
    setRestoreDialogOpen(true)
  }

  const handleRestore = async () => {
    if (!apiClient || !versionToRestore) return
    
    setIsRestoring(true)
    setError(null)
    
    try {
      const response = await apiClient.restoreDocumentVersion(documentId, versionToRestore.id)
      
      if (response.success) {
        // Update the document in the parent component
        onDocumentUpdated(response.document)
        
        // Refresh the version list to include the new version created during restore
        await loadVersions()
        
        // Close dialogs
        setRestoreDialogOpen(false)
        setIsPreviewMode(false)
        setSelectedVersion(null)
        
        // Show success message
        console.log('Document restored successfully')
      } else {
        setError(response.message || 'Failed to restore version')
      }
    } catch (err) {
      console.error('Failed to restore version:', err)
      setError('Failed to restore version')
    } finally {
      setIsRestoring(false)
      setVersionToRestore(null)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMinutes < 1) {
      return 'Just now'
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`
    } else if (diffHours < 24) {
      return `${diffHours}h ago`
    } else if (diffDays < 7) {
      return `${diffDays}d ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  const getContentPreview = (content: string, maxLength: number = 100) => {
    if (!content) return 'Empty document'
    
    // Remove HTML tags and decode HTML entities
    const cleanContent = content
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
      .replace(/&amp;/g, '&') // Replace encoded ampersands
      .replace(/&lt;/g, '<') // Replace encoded less than
      .replace(/&gt;/g, '>') // Replace encoded greater than
      .replace(/&quot;/g, '"') // Replace encoded quotes
      .replace(/&#39;/g, "'") // Replace encoded single quotes
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .trim()
    
    if (cleanContent.length <= maxLength) {
      return cleanContent
    }
    
    return cleanContent.substring(0, maxLength) + '...'
  }

  const renderMainView = () => (
    <div className="h-full overflow-y-auto">
      <div className="space-y-3">
        {error && (
          <div className="text-red-600 text-sm mb-4 p-3 bg-red-50 rounded">
            {error}
          </div>
        )}
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">Loading version history...</div>
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No version history yet</p>
            <p className="text-sm">Versions are created automatically when you edit the document</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {versions.map((version) => (
              <div
                key={version.id}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">
                        {formatDate(version.saved_at)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3 leading-relaxed">
                      {getContentPreview(version.content, 150)}
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePreviewVersion(version)}
                    className="flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" />
                    Preview
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRestoreClick(version)}
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restore
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const renderPreviewView = () => (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            Comparing version from {formatDate(selectedVersion?.saved_at || '')} with current document
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => selectedVersion && handleRestoreClick(selectedVersion)}
            className="flex items-center gap-1"
            disabled={isRestoring}
          >
            <RotateCcw className="w-3 h-3" />
            {isRestoring ? 'Restoring...' : 'Restore This Version'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPreviewMode(false)}
          >
            Back to List
          </Button>
        </div>
      </div>
      
      {/* Side-by-side comparison */}
      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
        {/* Current Document - Left Side */}
        <div className="border rounded-lg flex flex-col min-h-0">
          <div className="bg-green-50 px-4 py-3 text-sm font-medium border-b text-green-900 flex-shrink-0">
            📝 Current Document
          </div>
          <div className="p-4 overflow-y-auto flex-1 min-h-0">
            <div className="prose prose-sm max-w-none">
              {currentDocument.content ? (
                <div dangerouslySetInnerHTML={{ __html: currentDocument.content }} />
              ) : (
                <div className="text-gray-500 italic">Empty document</div>
              )}
            </div>
          </div>
        </div>

        {/* Previous Version - Right Side */}
        <div className="border rounded-lg flex flex-col min-h-0">
          <div className="bg-blue-50 px-4 py-3 text-sm font-medium border-b text-blue-900 flex-shrink-0">
            📄 Version from {formatDate(selectedVersion?.saved_at || '')}
          </div>
          <div className="p-4 overflow-y-auto flex-1 min-h-0">
            <div className="prose prose-sm max-w-none">
              {previewContent ? (
                <div dangerouslySetInnerHTML={{ __html: previewContent }} />
              ) : (
                <div className="text-gray-500 italic">Empty document</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          {trigger || (
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <History className="w-4 h-4" />
              Version History
            </Button>
          )}
        </SheetTrigger>
        <SheetContent className="w-[90vw] sm:!w-[90vw] !max-w-[1400px] sm:!max-w-[1400px]">
          <SheetHeader>
            <SheetTitle>Version History</SheetTitle>
            <SheetDescription>
              View and restore previous versions of your document
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 h-[calc(100vh-120px)] overflow-hidden">
            {isPreviewMode ? renderPreviewView() : renderMainView()}
          </div>
        </SheetContent>
      </Sheet>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Version?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore your document to the version from{' '}
              {versionToRestore && formatDate(versionToRestore.saved_at)}.
              <br />
              <br />
              <strong>Don&apos;t worry:</strong> Your current content will be saved as a new version 
              before restoring, so you won&apos;t lose any work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestore}
              disabled={isRestoring}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isRestoring ? 'Restoring...' : 'Restore Version'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
} 