'use client'

import { useState, useCallback } from 'react'
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { PenTool, Loader2 } from 'lucide-react'
import { RewriteSuggestionCard } from './RewriteSuggestionCard'
import { useAppStore } from '@/lib/store'
import type { 
  LengthRewriteRequest, 
  LengthRewriteResponse, 
  RetryRewriteRequest,
  RetryRewriteResponse
} from '@/types'

interface LengthRewriterProps {
  documentId: string
  documentContent: string
  onParagraphUpdate: (paragraphId: number, newContent: string, originalText?: string) => void
}

export function LengthRewriter({ 
  documentId, 
  documentContent, 
  onParagraphUpdate 
}: LengthRewriterProps) {
  // Form state
  const [targetLength, setTargetLength] = useState<string>('500')
  const [unit, setUnit] = useState<'words' | 'characters'>('words')
  const [mode, setMode] = useState<'shorten' | 'lengthen'>('shorten')
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)

  // Rewrite state
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [rewriteResponse, setRewriteResponse] = useState<LengthRewriteResponse | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [retryingParagraphs, setRetryingParagraphs] = useState<Set<number>>(new Set())
  const [dismissedParagraphs, setDismissedParagraphs] = useState<Set<number>>(new Set())

  // API client
  const { apiClient } = useAppStore()

  // Calculate current document length
  const getCurrentLength = useCallback((text: string, unit: 'words' | 'characters'): number => {
    if (unit === 'words') {
      return text.trim().split(/\s+/).length
    }
    return text.length
  }, [])

  const currentLength = getCurrentLength(documentContent, unit)

  // Handle form submission
  const handleAnalyzeDocument = async () => {
    const targetLengthNum = parseInt(targetLength)
    
    if (isNaN(targetLengthNum) || targetLengthNum <= 0) {
      alert('Please enter a valid target length')
      return
    }

    setIsAnalyzing(true)
    setIsPopoverOpen(false)

    try {
      const request: LengthRewriteRequest = {
        document_id: documentId,
        full_text: documentContent,
        target_length: targetLengthNum,
        unit,
        mode
      }

      const response = await apiClient.rewriteForLength(request)
      
      setRewriteResponse(response)
      setDismissedParagraphs(new Set()) // Reset dismissed paragraphs for new analysis
      setIsSheetOpen(true)
      
    } catch (error) {
      console.error('Failed to analyze document:', error)
      alert('Failed to analyze document. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Handle accepting a paragraph rewrite
  const handleAcceptRewrite = useCallback((paragraphId: number, rewrittenText: string, originalText?: string) => {
    onParagraphUpdate(paragraphId, rewrittenText, originalText)
    
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
  }, [onParagraphUpdate, rewriteResponse])

  // Handle retrying a paragraph rewrite
  const handleRetryRewrite = useCallback(async (paragraphId: number, retryRequest: RetryRewriteRequest) => {
    setRetryingParagraphs(prev => new Set(prev).add(paragraphId))

    try {
      const response: RetryRewriteResponse = await apiClient.retryRewrite(retryRequest)
      
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

  // Handle dismissing a paragraph rewrite
  const handleDismissRewrite = useCallback((paragraphId: number) => {
    setDismissedParagraphs(prev => new Set(prev).add(paragraphId))
  }, [])

  // Get visible suggestions (not dismissed)
  const visibleSuggestions = rewriteResponse?.paragraph_rewrites.filter(
    rewrite => !dismissedParagraphs.has(rewrite.paragraph_id)
  ) || []

  return (
    <>
      {/* Trigger Button with Popover Form */}
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
                Current length: <span className="font-medium">{currentLength} {unit}</span>
              </div>
              
              {/* Target Length Input */}
              <div className="space-y-2">
                <Label htmlFor="target-length">Target Length</Label>
                <Input
                  id="target-length"
                  type="number"
                  min="1"
                  value={targetLength}
                  onChange={(e) => setTargetLength(e.target.value)}
                  placeholder="e.g. 500"
                />
              </div>
              
              {/* Unit Select */}
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={unit} onValueChange={(value: 'words' | 'characters') => setUnit(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="words">Words</SelectItem>
                    <SelectItem value="characters">Characters</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Mode Select */}
              <div className="space-y-2">
                <Label>Mode</Label>
                <Select value={mode} onValueChange={(value: 'shorten' | 'lengthen') => setMode(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shorten">Shorten</SelectItem>
                    <SelectItem value="lengthen">Lengthen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
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
                  'Analyze Document'
                )}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Suggestions Side Panel */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-[400px] sm:max-w-[400px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Length Rewrite Suggestions</SheetTitle>
            <SheetDescription>
              {rewriteResponse && (
                <>
                  {rewriteResponse.mode === 'shorten' ? 'Shortening' : 'Lengthening'} from{' '}
                  {rewriteResponse.original_length} to {rewriteResponse.target_length} {rewriteResponse.unit}
                </>
              )}
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6">
            {visibleSuggestions.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                {rewriteResponse ? 'No suggestions available or all dismissed.' : 'No suggestions to display.'}
              </div>
            ) : (
              <div className="space-y-4">
                {visibleSuggestions.map((rewrite) => (
                  <RewriteSuggestionCard
                    key={rewrite.paragraph_id}
                    rewrite={rewrite}
                    unit={rewriteResponse?.unit || unit}
                    mode={rewriteResponse?.mode || mode}
                    onAccept={handleAcceptRewrite}
                    onRetry={handleRetryRewrite}
                    onDismiss={handleDismissRewrite}
                    isRetrying={retryingParagraphs.has(rewrite.paragraph_id)}
                  />
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
} 