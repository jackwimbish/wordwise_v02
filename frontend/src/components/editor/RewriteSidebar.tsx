'use client'

import { useState, useEffect, useCallback } from 'react'
import rs from 'text-readability'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChevronLeft, ChevronRight, PenTool, Loader2 } from 'lucide-react'
import { RewriteSuggestionCard } from './RewriteSuggestionCard'
import { useAppStore } from '@/lib/store'
import { 
  PageCountSettings, 
  convertPagesToCharacters, 
  calculateCharactersPerPage, 
  formatPageSettings 
} from '@/lib/utils'
import type { 
  LengthRewriteResponse, 
  LengthRewriteRequest,
  RetryRewriteRequest,
  ParagraphRewrite
} from '@/types'
import type { Editor } from '@tiptap/react'

interface RewriteSidebarProps {
  rewriteResponse: LengthRewriteResponse | null
  visibleSuggestions: ParagraphRewrite[]
  retryingParagraphs: Set<number>
  onAcceptRewrite: (paragraphId: number, rewrittenText: string, originalText?: string) => void
  onRetryRewrite: (paragraphId: number, retryRequest: RetryRewriteRequest) => Promise<void>
  onDismissRewrite: (paragraphId: number) => void
  unit: 'words' | 'characters'
  mode: 'shorten' | 'lengthen'
  documentId?: string
  documentContent?: string
  editorInstance?: Editor | null
  onRewriteResponse?: (response: LengthRewriteResponse | null) => void
  onDismissedParagraphs?: (paragraphs: Set<number>) => void
  pageSettings: PageCountSettings
}

export function RewriteSidebar({
  rewriteResponse,
  visibleSuggestions,
  retryingParagraphs,
  onAcceptRewrite,
  onRetryRewrite,
  onDismissRewrite,
  unit,
  mode,
  documentId,
  documentContent,
  editorInstance,
  onRewriteResponse,
  onDismissedParagraphs,
  pageSettings
}: RewriteSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Length tools form state
  const [targetLength, setTargetLength] = useState<string>('500')
  const [formUnit, setFormUnit] = useState<'words' | 'characters' | 'pages'>('words')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  
  // Update target length when unit changes
  useEffect(() => {
    if (formUnit === 'pages') {
      setTargetLength('2.0') // Default to 2 pages (with decimal for clarity)
    } else if (formUnit === 'words') {
      setTargetLength('500') // Default to 500 words
    } else {
      setTargetLength('2000') // Default to 2000 characters
    }
  }, [formUnit])
  
  // API client
  const { apiClient } = useAppStore()
  
  // Auto-expand when suggestions first become available, auto-collapse when they're gone
  const hasSuggestions = visibleSuggestions.length > 0
  
  // Auto-expand when suggestions appear or when new suggestions arrive, auto-collapse when they disappear
  useEffect(() => {
    if (hasSuggestions) {
      setIsExpanded(true)
    } else {
      setIsExpanded(false)
    }
  }, [hasSuggestions])
  
  // Also auto-expand when new suggestions arrive (even if there were already suggestions)
  useEffect(() => {
    if (rewriteResponse && visibleSuggestions.length > 0) {
      setIsExpanded(true)
    }
  }, [rewriteResponse, visibleSuggestions.length])
  
  const actuallyExpanded = isExpanded

  // Calculate current document length (using same method as ReadabilityScore for consistency)
  const getCurrentLength = useCallback((text: string, unit: 'words' | 'characters' | 'pages'): number => {
    if (!text || text.trim().length === 0) return 0
    
    if (unit === 'words') {
      // Use the same word counting method as ReadabilityScore component
      try {
        return rs.lexiconCount(text)
      } catch (error) {
        console.warn('Error using lexiconCount, falling back to simple count:', error)
        return text.trim().split(/\s+/).length
      }
    } else if (unit === 'characters') {
      // Normalize whitespace for character counting (same as PageCount component)
      const cleanText = text.replace(/\s+/g, ' ').trim()
      return cleanText.length
    } else if (unit === 'pages') {
      // For pages, calculate using page settings
      const cleanText = text.replace(/\s+/g, ' ').trim()
      const charsPerPage = calculateCharactersPerPage(pageSettings)
      return cleanText.length / charsPerPage
    }
    
    return 0
  }, [pageSettings])

  // Calculate current document length using real-time text from editor if available
  const getCurrentDocumentText = useCallback(() => {
    if (editorInstance) {
      return editorInstance.getText()
    }
    return documentContent || ''
  }, [editorInstance, documentContent])

  const currentLength = getCurrentLength(getCurrentDocumentText(), formUnit)

  // Handle form submission
  const handleAnalyzeDocument = async () => {
    if (!documentId || !onRewriteResponse || !onDismissedParagraphs) {
      return
    }

    // Get real-time HTML content from editor if available, fallback to documentContent
    let currentContent: string
    if (editorInstance) {
      currentContent = editorInstance.getHTML()
      console.log('📝 Using real-time HTML from editor:', currentContent.slice(0, 100) + '...')
    } else if (documentContent) {
      // documentContent is plain text, so we need to wrap it in basic HTML
      currentContent = `<p>${documentContent.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`
      console.log('⚠️ Fallback to documentContent converted to HTML:', currentContent.slice(0, 100) + '...')
    } else {
      alert('No document content available')
      return
    }

    // Extract plain text for length validation
    const currentText = editorInstance ? editorInstance.getText() : documentContent || ''

    if (!currentText.trim()) {
      alert('Please write some content before using length tools')
      return
    }

    // Use parseFloat for pages (which can be decimal), parseInt for others
    const targetLengthNum = formUnit === 'pages' ? parseFloat(targetLength) : parseInt(targetLength)
    
    if (isNaN(targetLengthNum) || targetLengthNum <= 0) {
      alert('Please enter a valid target length')
      return
    }

    setIsAnalyzing(true)

    try {
      // Convert pages to characters if needed
      let actualTargetLength = targetLengthNum
      let actualUnit: 'words' | 'characters' = formUnit as 'words' | 'characters'
      
      if (formUnit === 'pages') {
        actualTargetLength = convertPagesToCharacters(targetLengthNum, pageSettings)
        actualUnit = 'characters'
      }

      const request: LengthRewriteRequest = {
        document_id: documentId,
        full_text: currentContent,
        target_length: actualTargetLength,
        unit: actualUnit
        // mode will be determined automatically by the backend
      }

      const response = await apiClient.rewriteForLength(request)
      
      onRewriteResponse(response)
      onDismissedParagraphs(new Set()) // Reset dismissed paragraphs for new analysis
      
    } catch (error) {
      console.error('Failed to analyze document:', error)
      alert('Failed to analyze document. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const baseWidth = 'w-80' // Same as left sidebar
  const expandedWidth = 'w-[700px]' // Wider when showing suggestions

  return (
    <div className={`flex-shrink-0 bg-white/50 border-l border-gray-200 transition-all duration-300 ${
      actuallyExpanded ? expandedWidth : baseWidth
    }`}>
      <div className="h-full flex flex-col">
        {/* Header with expand/collapse control */}
        <div className="p-4 border-b border-gray-200 bg-white/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PenTool className="w-5 h-5 text-blue-600" />
              <h3 className="font-medium text-gray-900">
                {actuallyExpanded ? 'Rewrite Suggestions' : 'Length Tools'}
              </h3>
            </div>
            
            {/* Expand/Collapse Button - always show */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </Button>
          </div>
          
          {/* Summary when expanded and has suggestions */}
          {actuallyExpanded && rewriteResponse && (
            <div className="mt-2 text-sm text-gray-600">
              {rewriteResponse.mode === 'shorten' ? 'Shortening' : 'Lengthening'} from{' '}
              {rewriteResponse.original_length} to {rewriteResponse.target_length} {rewriteResponse.unit}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {actuallyExpanded ? (
            <div className="p-4">
              {visibleSuggestions.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  {rewriteResponse ? (
                    <div className="space-y-2">
                      <PenTool className="w-8 h-8 mx-auto text-gray-400" />
                      <p>No suggestions available or all dismissed.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <PenTool className="w-8 h-8 mx-auto text-gray-400" />
                      <p>Use the Length Tools button in the editor toolbar to generate rewrite suggestions.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {visibleSuggestions.map((rewrite) => (
                    <RewriteSuggestionCard
                      key={rewrite.paragraph_id}
                      rewrite={rewrite}
                      unit={rewriteResponse?.unit || unit}
                      mode={rewriteResponse?.mode || mode}
                      onAccept={onAcceptRewrite}
                      onRetry={onRetryRewrite}
                      onDismiss={onDismissRewrite}
                      isRetrying={retryingParagraphs.has(rewrite.paragraph_id)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Collapsed state - always show length tools form, with suggestions summary below if available
            <div className="p-4 space-y-4">
              {/* Length tools form - always shown when collapsed */}
              <div className="space-y-3">
                                  {/* Current Length Display */}
                  {getCurrentDocumentText().trim() && (
                    <div className="text-sm text-gray-600 text-center">
                      Current length: <span className="font-medium">
                        {formUnit === 'pages' ? currentLength.toFixed(1) : Math.round(currentLength)} {formUnit}
                      </span>
                    </div>
                  )}
                  
                  {/* Page Settings Display & Conversion (when pages is selected) */}
                  {formUnit === 'pages' && (
                    <div className="space-y-2">
                      <div className="text-xs text-gray-500 text-center">
                        Settings: {formatPageSettings(pageSettings)}
                      </div>
                      <div className="text-xs text-gray-500 text-center">
                        ≈ {calculateCharactersPerPage(pageSettings)} characters per page
                      </div>
                      {targetLength && !isNaN(parseFloat(targetLength)) && (
                        <div className="text-xs text-blue-600 text-center font-medium">
                          Target: {targetLength} pages = ~{convertPagesToCharacters(parseFloat(targetLength), pageSettings).toLocaleString()} characters
                        </div>
                      )}
                    </div>
                  )}
                
                                  {/* Target Length Input */}
                  <div className="space-y-2">
                    <Label htmlFor="target-length">Target Length</Label>
                    <Input
                      id="target-length"
                      type="number"
                      min={formUnit === 'pages' ? '0.1' : '1'}
                      step={formUnit === 'pages' ? '0.1' : '1'}
                      onInput={(e) => {
                        // For non-pages units, prevent decimal input
                        if (formUnit !== 'pages') {
                          const value = e.currentTarget.value;
                          if (value.includes('.')) {
                            e.currentTarget.value = value.split('.')[0];
                            setTargetLength(e.currentTarget.value);
                          }
                        }
                      }}
                      value={targetLength}
                      onChange={(e) => setTargetLength(e.target.value)}
                      placeholder={
                        formUnit === 'pages' ? 'e.g. 2' : 
                        formUnit === 'words' ? 'e.g. 500' : 
                        'e.g. 2000'
                      }
                    />
                  </div>
                
                                  {/* Unit Select */}
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Select value={formUnit} onValueChange={(value: 'words' | 'characters' | 'pages') => setFormUnit(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="words">Words</SelectItem>
                        <SelectItem value="characters">Characters</SelectItem>
                        <SelectItem value="pages">Pages</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                
                {/* Mode will be determined automatically by the backend based on target vs current length */}
                
                {/* Analyze Button */}
                <Button 
                  onClick={handleAnalyzeDocument} 
                  className="w-full"
                  disabled={isAnalyzing || !documentId || !documentContent}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    `Rewrite to ${targetLength || 'Target'} ${formUnit === 'pages' ? (parseFloat(targetLength) === 1 ? 'Page' : 'Pages') : (parseInt(targetLength) === 1 ? formUnit.slice(0, -1) : formUnit)}`
                  )}
                </Button>
              </div>

              {/* Show suggestions summary below length tools when available */}
              {hasSuggestions && (
                <Card className="border-solid border-blue-200 bg-blue-50">
                  <CardContent className="p-4 text-center">
                    <PenTool className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-blue-900">
                        {visibleSuggestions.length} suggestion{visibleSuggestions.length !== 1 ? 's' : ''} available
                      </p>
                      <p className="text-xs text-blue-700">
                        Click to expand and view suggestions
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 