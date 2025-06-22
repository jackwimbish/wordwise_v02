'use client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RotateCcw, Check, X } from 'lucide-react'

import type { ParagraphRewrite, RetryRewriteRequest } from '@/types'

interface RewriteSuggestionCardProps {
  rewrite: ParagraphRewrite
  unit: string
  mode: string
  onAccept: (paragraphId: number, rewrittenText: string, originalText?: string) => void
  onRetry: (paragraphId: number, retryRequest: RetryRewriteRequest) => void
  onDismiss: (paragraphId: number) => void
  isRetrying?: boolean
}

export function RewriteSuggestionCard({
  rewrite,
  unit,
  mode,
  onAccept,
  onRetry,
  onDismiss,
  isRetrying = false
}: RewriteSuggestionCardProps) {

  // Extract text content from HTML for display purposes
  const getTextContent = (htmlContent: string): string => {
    if (htmlContent.includes('<') && htmlContent.includes('>')) {
      const parser = new DOMParser()
      const doc = parser.parseFromString(htmlContent, 'text/html')
      return doc.body.textContent || htmlContent
    }
    return htmlContent
  }

  const originalTextDisplay = getTextContent(rewrite.original_text)
  const rewrittenTextDisplay = getTextContent(rewrite.rewritten_text)

  const handleAccept = () => {
    onAccept(rewrite.paragraph_id, rewrite.rewritten_text, rewrite.original_text)
  }

  const handleRetry = () => {
    const retryRequest: RetryRewriteRequest = {
      original_paragraph: rewrite.original_text,
      previous_suggestion: rewrite.rewritten_text,
      target_length: rewrite.rewritten_length, // Use the target that was attempted
      unit: unit as 'words' | 'characters',
      mode: mode as 'shorten' | 'lengthen'
    }
    onRetry(rewrite.paragraph_id, retryRequest)
  }

  const handleDismiss = () => {
    onDismiss(rewrite.paragraph_id)
  }

  const changeType = mode === 'shorten' ? 'Shortened' : 'Lengthened'
  const lengthChange = rewrite.rewritten_length - rewrite.original_length
  const changeSign = lengthChange > 0 ? '+' : ''

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">
          Paragraph {rewrite.paragraph_id + 1}: {changeType} from {rewrite.original_length} to {rewrite.rewritten_length} {unit}
          <span className={`ml-2 text-xs ${lengthChange > 0 ? 'text-green-600' : 'text-blue-600'}`}>
            ({changeSign}{lengthChange} {unit})
          </span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Text Comparison */}
        <div className="border rounded-md overflow-hidden">
          <div className="text-sm">
            <div className="bg-red-50 border-l-4 border-red-200 p-3">
              <div className="text-red-800 font-medium mb-1">Original:</div>
              <div className="text-red-900 whitespace-pre-wrap">{originalTextDisplay}</div>
            </div>
            <div className="bg-green-50 border-l-4 border-green-200 p-3">
              <div className="text-green-800 font-medium mb-1">Rewritten:</div>
              <div className="text-green-900 whitespace-pre-wrap">{rewrittenTextDisplay}</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleAccept}
            size="sm"
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          >
            <Check className="w-4 h-4 mr-1" />
            Accept
          </Button>
          
          <Button
            onClick={handleRetry}
            size="sm"
            variant="outline"
            disabled={isRetrying}
            className="flex-1"
          >
            <RotateCcw className={`w-4 h-4 mr-1 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Retrying...' : 'Retry'}
          </Button>
          
          <Button
            onClick={handleDismiss}
            size="sm"
            variant="ghost"
            className="px-3"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
} 