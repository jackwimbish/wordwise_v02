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
import { PenTool, Loader2 } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import type { 
  LengthRewriteRequest, 
  LengthRewriteResponse
} from '@/types'

interface LengthRewriterProps {
  documentId: string
  documentContent: string
  onRewriteResponse: (response: LengthRewriteResponse | null) => void
  onDismissedParagraphs: (paragraphs: Set<number>) => void
}

export function LengthRewriter({ 
  documentId, 
  documentContent, 
  onRewriteResponse,
  onDismissedParagraphs
}: LengthRewriterProps) {
  // Form state
  const [targetLength, setTargetLength] = useState<string>('500')
  const [unit, setUnit] = useState<'words' | 'characters'>('words')
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)

  // Rewrite state
  const [isAnalyzing, setIsAnalyzing] = useState(false)

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
        unit
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
                'Rewrite to Target Length'
              )}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
} 