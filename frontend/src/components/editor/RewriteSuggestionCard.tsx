'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RotateCcw, Check, X } from 'lucide-react'
import ReactDiffViewer from 'react-diff-viewer-continued'
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
  const [isExpanded, setIsExpanded] = useState(false)

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
        {/* Preview or Full Diff */}
        <div className="border rounded-md overflow-hidden">
          {isExpanded ? (
            <ReactDiffViewer
              oldValue={rewrite.original_text}
              newValue={rewrite.rewritten_text}
              splitView={false}
              hideLineNumbers={true}
              useDarkTheme={false}
              styles={{
                variables: {
                  light: {
                    codeFoldGutterBackground: '#f7f7f7',
                    codeFoldBackground: '#f1f8ff',
                  }
                },
                contentText: {
                  fontSize: '14px',
                  lineHeight: '1.5',
                },
                diffContainer: {
                  fontSize: '14px',
                }
              }}
            />
          ) : (
            <div className="p-3 space-y-2">
              <div className="text-sm">
                <div className="text-gray-600 mb-1">Original:</div>
                <div className="text-gray-900 line-clamp-2">{rewrite.original_text}</div>
              </div>
              <div className="text-sm">
                <div className="text-gray-600 mb-1">Rewritten:</div>
                <div className="text-gray-900 line-clamp-2 font-medium">{rewrite.rewritten_text}</div>
              </div>
            </div>
          )}
        </div>

        {/* Toggle Diff View */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs h-8"
        >
          {isExpanded ? 'Show Preview' : 'Show Full Diff'}
        </Button>

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