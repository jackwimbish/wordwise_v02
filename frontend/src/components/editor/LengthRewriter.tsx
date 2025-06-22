'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PenTool, Loader2 } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { 
  PageCountSettings, 
  DEFAULT_PAGE_SETTINGS, 
  convertPagesToCharacters, 
  calculateCharactersPerPage, 
  formatPageSettings 
} from '@/lib/utils'
import rs from 'text-readability'
import type { 
  LengthRewriteRequest, 
  LengthRewriteResponse
} from '@/types'
import type { Editor } from '@tiptap/react'

interface LengthRewriterProps {
  documentId: string
  documentContent: string
  editorInstance?: Editor | null
  onRewriteResponse: (response: LengthRewriteResponse | null) => void
  onDismissedParagraphs: (paragraphs: Set<number>) => void
  pageSettings?: PageCountSettings
}

export function LengthRewriter({ 
  documentId, 
  documentContent, 
  editorInstance,
  onRewriteResponse,
  onDismissedParagraphs,
  pageSettings = DEFAULT_PAGE_SETTINGS
}: LengthRewriterProps) {
  // Form state
  const [targetLength, setTargetLength] = useState<string>('500')
  const [unit, setUnit] = useState<'words' | 'characters' | 'pages'>('words')
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  
  // Update target length when unit changes
  useEffect(() => {
    if (unit === 'pages') {
      setTargetLength('2.0') // Default to 2 pages (with decimal for clarity)
    } else if (unit === 'words') {
      setTargetLength('500') // Default to 500 words
    } else {
      setTargetLength('2000') // Default to 2000 characters
    }
  }, [unit])

  // Rewrite state
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // API client
  const { apiClient } = useAppStore()

  // Calculate current document length
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

  // Get current text from editor if available, fallback to documentContent
  const getCurrentDocumentText = useCallback(() => {
    if (editorInstance) {
      return editorInstance.getText()
    }
    return documentContent || ''
  }, [editorInstance, documentContent])

  const currentLength = getCurrentLength(getCurrentDocumentText(), unit)

  // Handle form submission
  const handleAnalyzeDocument = async () => {
    // Get real-time text content from editor if available, fallback to documentContent
    const currentText = getCurrentDocumentText()
    
    if (!currentText.trim()) {
      alert('Please write some content before using length tools')
      return
    }

    // Use parseFloat for pages (which can be decimal), parseInt for others
    const targetLengthNum = unit === 'pages' ? parseFloat(targetLength) : parseInt(targetLength)
    
    if (isNaN(targetLengthNum) || targetLengthNum <= 0) {
      alert('Please enter a valid target length')
      return
    }

    setIsAnalyzing(true)
    setIsPopoverOpen(false)

    try {
      // Convert pages to characters if needed
      let actualTargetLength = targetLengthNum
      let actualUnit: 'words' | 'characters' = unit as 'words' | 'characters'
      
      if (unit === 'pages') {
        actualTargetLength = convertPagesToCharacters(targetLengthNum, pageSettings)
        actualUnit = 'characters'
      }

      const request: LengthRewriteRequest = {
        document_id: documentId,
        full_text: currentText,
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

  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={isAnalyzing}>
          <PenTool className="w-4 h-4 mr-2" />
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            'Length Tools'
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Rewrite for Target Length</h4>
            <p className="text-sm text-muted-foreground">
              Adjust your document to meet specific length requirements.
            </p>
          </div>
          
          <div className="space-y-3">
            {/* Current Length Display */}
            <div className="text-sm text-gray-600">
              Current length: <span className="font-medium">
                {unit === 'pages' ? currentLength.toFixed(1) : Math.round(currentLength)} {unit}
              </span>
            </div>
            
            {/* Page Settings Display & Conversion (when pages is selected) */}
            {unit === 'pages' && (
              <div className="space-y-2">
                <div className="text-xs text-gray-500">
                  Settings: {formatPageSettings(pageSettings)}
                </div>
                <div className="text-xs text-gray-500">
                  ≈ {calculateCharactersPerPage(pageSettings)} characters per page
                </div>
                                 {targetLength && !isNaN(parseFloat(targetLength)) && (
                   <div className="text-xs text-blue-600 font-medium">
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
                min={unit === 'pages' ? '0.1' : '1'}
                step={unit === 'pages' ? '0.1' : '1'}
                onInput={(e) => {
                  // For non-pages units, prevent decimal input
                  if (unit !== 'pages') {
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
                  unit === 'pages' ? 'e.g. 2' : 
                  unit === 'words' ? 'e.g. 500' : 
                  'e.g. 2000'
                }
              />
            </div>
            
            {/* Unit Select */}
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select value={unit} onValueChange={(value: 'words' | 'characters' | 'pages') => setUnit(value)}>
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
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                `Rewrite to ${targetLength || 'Target'} ${unit === 'pages' ? (parseFloat(targetLength) === 1 ? 'Page' : 'Pages') : (parseInt(targetLength) === 1 ? unit.slice(0, -1) : unit)}`
              )}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
} 