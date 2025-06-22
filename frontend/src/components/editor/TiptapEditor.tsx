'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Extension } from '@tiptap/core'
import { Transaction } from '@tiptap/pm/state'
import { Button } from '@/components/ui/button'
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
import { SuggestionExtension } from '@/lib/editor/SuggestionExtension'
import { SuggestionPopup } from '@/components/editor/SuggestionPopup'

import { useAppStore } from '@/lib/store'
import type { SuggestionResponse, ParagraphToAnalyze, ParagraphAnalysisRequest } from '@/types'

interface TiptapEditorProps {
  content: string
  onUpdate: (content: string) => void
  placeholder?: string
  editable?: boolean
  documentId?: string
  onReadabilityTextChange?: (text: string) => void
  onEditorReady?: (editor: Editor) => void
}

// Helper function to create a simple hash of text content
function hashContent(text: string): string {
  let hash = 0
  if (text.length === 0) return hash.toString()
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash.toString()
}

// Custom extension to handle Shift+Enter for hard breaks
const CustomKeyboardShortcuts = Extension.create({
  name: 'customKeyboardShortcuts',

  addKeyboardShortcuts() {
    return {
      'Shift-Enter': () => this.editor.commands.setHardBreak(),
    }
  },
})

// Interface for tracking paragraph state
interface ParagraphState {
  id: string
  content: string
  contentHash: string
  baseOffset: number
  isDirty: boolean
}

// Interface for storing transactions during API calls
interface StoredTransaction {
  transaction: Transaction
  mapping: Transaction['mapping']
}

export function TiptapEditor({ 
  content, 
  onUpdate, 
  placeholder = 'Start writing...', 
  editable = true,
  documentId,
  onReadabilityTextChange,
  onEditorReady
}: TiptapEditorProps) {
  // State for live suggestions from backend
  const [suggestions, setSuggestions] = useState<SuggestionResponse[]>([])
  
  // Suggestion popup state
  const [selectedSuggestion, setSelectedSuggestion] = useState<SuggestionResponse | null>(null)
  const [popupVisible, setPopupVisible] = useState(false)
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0, positionAbove: true })
  
  // Paragraph tracking state
  const [paragraphs, setParagraphs] = useState<Map<string, ParagraphState>>(new Map())
  
  // API call state
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisErrors, setAnalysisErrors] = useState<string[]>([])
  
  // Reset dialog state
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  
  // Post-analysis follow-up state
  const needsFollowUpAnalysis = useRef(false)
  
  // Stale state management
  const pendingTransactions = useRef<StoredTransaction[]>([])
  const analysisInProgress = useRef(false)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const readabilityDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const apiCallDocState = useRef<string | null>(null)
  const currentAbortController = useRef<AbortController | null>(null)
  const hasInitialAnalysisRun = useRef(false)
  
  // Editor reference
  const editorRef = useRef<typeof editor>(null)
  
  // Get API client from store
  const { apiClient } = useAppStore()

  // Helper function to detect significant text changes
  const hasSignificantTextChange = useCallback((originalText: string, currentText: string): boolean => {
    // If either text is empty, it's not significant for our purposes
    if (!originalText || !currentText) return false
    
    // Calculate length difference percentage
    const lengthDiff = Math.abs(currentText.length - originalText.length)
    const lengthChangePercent = lengthDiff / originalText.length
    
    // Consider it significant if:
    // 1. Length changed by more than 20%
    // 2. Or absolute character difference is more than 10 characters
    return lengthChangePercent > 0.2 || lengthDiff > 10
  }, [])

  // Extract paragraphs from the editor content
  const extractParagraphs = useCallback((editor: Editor): ParagraphState[] => {
    const paragraphStates: ParagraphState[] = []
    
    console.log('🔍 Document structure analysis:')
    console.log('Doc content size:', editor.state.doc.content.size)
    console.log('Doc text length:', editor.state.doc.textContent.length)
    console.log('Full text:', JSON.stringify(editor.state.doc.textContent))
    
    // Let's also check the actual position of text content
    editor.state.doc.descendants((node, pos) => {
      console.log(`Node at pos ${pos}: type="${node.type.name}", size=${node.nodeSize}, text="${node.textContent.slice(0, 20)}..."`)
      
      if (node.type.name === 'paragraph') {
        const content = node.textContent
        const contentHash = hashContent(content)
        
        // Find the actual start position of the text content within this paragraph
        let actualTextStart = pos
        
        // Try different offsets to find where the text actually starts
        for (let offset = 0; offset <= 5; offset++) {
          try {
            const testPos = pos + offset
            if (testPos < editor.state.doc.content.size) {
              const testText = editor.state.doc.textBetween(testPos, Math.min(testPos + content.length, editor.state.doc.content.size))
              console.log(`  Testing offset +${offset} at pos ${testPos}: "${testText.slice(0, 20)}..."`)
              
              if (testText === content || testText.startsWith(content.slice(0, 10))) {
                actualTextStart = testPos
                console.log(`  ✅ Found text start at pos ${testPos} (offset +${offset})`)
                break
              }
            }
          } catch (error) {
            console.log(`  ❌ Error testing offset +${offset}:`, error)
          }
        }
        
        // Generate consistent paragraph ID based on position and hash
        const paragraphId = `p_${pos}_${contentHash.slice(0, 8)}`
        
        paragraphStates.push({
          id: paragraphId,
          content,
          contentHash,
          baseOffset: actualTextStart, // Use the actual text start position
          isDirty: false
        })
        
        console.log(`📍 Paragraph "${content.slice(0, 20)}..." node_pos=${pos}, text_start=${actualTextStart}`)
      }
    })
    
    return paragraphStates
  }, [])

  // Detect dirty paragraphs by comparing with previous state
  const updateParagraphStates = useCallback((newParagraphs: ParagraphState[]) => {
    const updatedParagraphs = new Map<string, ParagraphState>()
    
    newParagraphs.forEach(newParagraph => {
      const existing = paragraphs.get(newParagraph.id)
      
      const isDirty = !existing || existing.contentHash !== newParagraph.contentHash
      
      updatedParagraphs.set(newParagraph.id, {
        ...newParagraph,
        isDirty
      })
    })
    
    setParagraphs(updatedParagraphs)
    return updatedParagraphs
  }, [paragraphs])

  // Core analysis function that takes paragraphs directly
  const performAnalysis = useCallback(async (paragraphsToAnalyze: ParagraphState[]) => {
    if (!documentId || !apiClient || analysisInProgress.current) return
    
    console.log(`🚀 performAnalysis called with ${paragraphsToAnalyze.length} paragraphs`)
    
    if (paragraphsToAnalyze.length === 0) return
    
    // Cancel any ongoing analysis
    if (currentAbortController.current) {
      currentAbortController.current.abort()
    }
    
    // Create new AbortController for this request
    const abortController = new AbortController()
    currentAbortController.current = abortController
    
    try {
      analysisInProgress.current = true
      setIsAnalyzing(true)
      setAnalysisErrors([])
      
      // Clear pending transactions at start of new request
      pendingTransactions.current = []
      
      // Capture current document state for mapping baseline
      if (editorRef.current) {
        apiCallDocState.current = editorRef.current.state.doc.textContent
      }
      
      // Prepare request
      const paragraphsForRequest: ParagraphToAnalyze[] = paragraphsToAnalyze.map(p => ({
        paragraph_id: p.id,
        text_content: p.content,
        base_offset: p.baseOffset
      }))
      
      const request: ParagraphAnalysisRequest = {
        document_id: documentId,
        paragraphs: paragraphsForRequest
      }
      
      console.log('📤 Request details:', {
        document_id: request.document_id,
        paragraphs_count: request.paragraphs.length,
        has_api_client: !!apiClient
      })
      console.log('📤 Full request:', request)
      
      // Debug: Log paragraph positions for verification
      paragraphsForRequest.forEach(p => {
        console.log(`📍 Paragraph "${p.text_content.slice(0, 50)}..." base_offset: ${p.base_offset}`)
      })
      
      // Make API call with abort signal
      console.log('🚀 Making API call to analyze paragraphs...')
      const response = await apiClient.analyzeParagraphs(request, abortController.signal)
      
      console.log('📥 Analysis response received:', {
        suggestions: response.suggestions?.length || 0,
        errors: response.errors?.length || 0,
        totalParagraphsProcessed: response.total_paragraphs_processed
      })
      console.log('📥 Full response:', response)
      
      // Log individual suggestions for debugging
      if (response.suggestions && response.suggestions.length > 0) {
        response.suggestions.forEach((suggestion, index) => {
          console.log(`📝 Suggestion ${index + 1}:`, {
            rule_id: suggestion.rule_id,
            category: suggestion.category,
            original_text: suggestion.original_text,
            suggestion_text: suggestion.suggestion_text,
            message: suggestion.message,
            positions: `${suggestion.global_start}-${suggestion.global_end}`
          })
        })
      } else {
        console.log('⚠️ No suggestions returned from API')
      }
      
      // Transform suggestions based on minor transactions that occurred during the API call
      // (Major changes trigger cancellation and restart, so this handles small edits only)
      let transformedSuggestions = response.suggestions
      
      if (pendingTransactions.current.length > 0) {
        console.log(`📍 Applying ${pendingTransactions.current.length} minor position adjustments to ${response.suggestions.length} suggestions`)
        
        transformedSuggestions = response.suggestions.map(suggestion => {
          try {
            // Apply mappings sequentially for minor adjustments
            let newStart = suggestion.global_start
            let newEnd = suggestion.global_end
            
            // Apply each transaction's mapping in sequence
            for (const { transaction } of pendingTransactions.current) {
              newStart = transaction.mapping.map(newStart)
              newEnd = transaction.mapping.map(newEnd)
            }
            
            // Validate the transformed suggestion with comprehensive bounds checking
            if (newStart >= 0 && newEnd > newStart && editorRef.current) {
              const docSize = editorRef.current.state.doc.content.size
              
              // Ensure positions are within document bounds
              if (newEnd <= docSize && newStart < docSize) {
                try {
                  const text = editorRef.current.state.doc.textBetween(newStart, newEnd)
                  
                  if (text && text.length > 0) {
                    return {
                      ...suggestion,
                      global_start: newStart,
                      global_end: newEnd
                    }
                  }
                } catch (error) {
                  console.warn(`Failed to read text at positions ${newStart}-${newEnd} (doc size: ${docSize}):`, error)
                }
              } else {
                console.warn(`Positions out of bounds: ${newStart}-${newEnd} (doc size: ${docSize})`)
              }
            }
          } catch (error) {
            console.warn('Failed to apply minor position mapping:', error)
          }
          
          return null // Invalid suggestion
        }).filter(Boolean) as SuggestionResponse[]
      }
      
      // Debug: Verify final suggestion positions with safe text reading
      transformedSuggestions.forEach(s => {
        if (editorRef.current) {
          const docSize = editorRef.current.state.doc.content.size
          
          // Ensure positions are valid before reading text
          if (s.global_start >= 0 && s.global_end <= docSize && s.global_start < s.global_end) {
            try {
              const text = editorRef.current.state.doc.textBetween(s.global_start, s.global_end)
              
              if (text === s.original_text) {
                console.log(`✅ Suggestion "${s.original_text}" positioned correctly at ${s.global_start}-${s.global_end}`)
              } else {
                console.warn(`🚨 Position error: "${s.original_text}" -> "${text}" at ${s.global_start}-${s.global_end}`)
                
                // Try to find the correct position by searching the document
                const docText = editorRef.current.state.doc.textContent
                const correctIndex = docText.indexOf(s.original_text)
                if (correctIndex !== -1) {
                  console.log(`  🔍 Correct position should be: ${correctIndex}-${correctIndex + s.original_text.length}`)
                  console.log(`  📊 Position difference: expected ${s.global_start}, actual ${correctIndex} (off by ${s.global_start - correctIndex})`)
                }
                
                // Show surrounding context safely
                const contextStart = Math.max(0, s.global_start - 10)
                const contextEnd = Math.min(docSize, s.global_end + 10)
                try {
                  const context = editorRef.current.state.doc.textBetween(contextStart, contextEnd)
                  console.log(`  📝 Context: "${context}"`)
                } catch (contextError) {
                  console.warn(`  📝 Could not read context: ${contextError}`)
                }
              }
            } catch (error) {
              console.warn(`Failed to verify suggestion position ${s.global_start}-${s.global_end}:`, error)
            }
          } else {
            console.warn(`Invalid suggestion positions: ${s.global_start}-${s.global_end} (doc size: ${docSize})`)
          }
        }
      })
      
      // Update suggestions state by merging with existing suggestions from non-analyzed paragraphs
      console.log(`🔄 Merging ${transformedSuggestions.length} new suggestions with existing suggestions`)
      
      setSuggestions(prevSuggestions => {
        // Get IDs of paragraphs that were analyzed
        const analyzedParagraphIds = new Set(paragraphsToAnalyze.map(p => p.id))
        
        // Keep suggestions from paragraphs that were NOT analyzed
        const suggestionsToKeep = prevSuggestions.filter(suggestion => {
          // Find which paragraph this suggestion belongs to by checking its position
          const suggestionParagraph = Array.from(paragraphs.values()).find(p => {
            // Check if suggestion falls within this paragraph's range
            return suggestion.global_start >= p.baseOffset && 
                   suggestion.global_start < p.baseOffset + p.content.length + 50 // Add buffer for safety
          })
          
          // Keep suggestion if it's from a paragraph that wasn't analyzed
          const shouldKeep = !suggestionParagraph || !analyzedParagraphIds.has(suggestionParagraph.id)
          
          if (shouldKeep) {
            console.log(`📌 Keeping suggestion "${suggestion.original_text}" from non-analyzed paragraph`)
          } else {
            console.log(`🗑️ Removing old suggestion "${suggestion.original_text}" from analyzed paragraph ${suggestionParagraph?.id}`)
          }
          
          return shouldKeep
        })
        
        // Combine kept suggestions with new suggestions
        const mergedSuggestions = [...suggestionsToKeep, ...transformedSuggestions]
        
        console.log(`🎯 Suggestion merge complete: ${suggestionsToKeep.length} kept + ${transformedSuggestions.length} new = ${mergedSuggestions.length} total`)
        
        return mergedSuggestions
      })
      
      // Mark analyzed paragraphs as clean
      const cleanParagraphs = new Map(paragraphs)
      paragraphsToAnalyze.forEach(p => {
        const existing = cleanParagraphs.get(p.id)
        if (existing) {
          cleanParagraphs.set(p.id, { ...existing, isDirty: false })
        }
      })
      setParagraphs(cleanParagraphs)
      
      // Set analysis errors if any
      if (response.errors && response.errors.length > 0) {
        setAnalysisErrors(response.errors)
      }
      
    } catch (error) {
      // Don't log errors for aborted requests (these are expected when we cancel)
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.log('Analysis request was cancelled')
        return
      }
      
      console.error('❌ Failed to analyze paragraphs:', error)
      console.error('❌ Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      setAnalysisErrors([`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`])
    } finally {
      analysisInProgress.current = false
      setIsAnalyzing(false)
      pendingTransactions.current = []
      apiCallDocState.current = null
      currentAbortController.current = null
      
      // Check if we need follow-up analysis for changes that occurred during this analysis
      if (needsFollowUpAnalysis.current) {
        console.log('🔄 Follow-up analysis needed - triggering analysis for changes made during previous analysis')
        needsFollowUpAnalysis.current = false
        
        // Use a small delay to avoid immediate re-triggering and let the UI update
        // Trigger fresh analysis for follow-up - extraction will happen inside debounced function
        if (debounceTimeoutRef.current) {
          clearTimeout(debounceTimeoutRef.current)
        }
        
        debounceTimeoutRef.current = setTimeout(() => {
          console.log('🔄 Follow-up analysis triggered - will use fresh paragraph extraction')
          // Use triggerAnalysis instead of calling analyzeDirtyParagraphs directly to avoid circular dependency
          if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current)
          }
          debounceTimeoutRef.current = setTimeout(() => {
            if (editorRef.current) {
              // Extract fresh paragraphs
              const freshParagraphs = extractParagraphs(editorRef.current)
              const updatedParagraphs = updateParagraphStates(freshParagraphs)
              const dirtyParagraphs = Array.from(updatedParagraphs.values()).filter(p => p.isDirty && p.content.trim().length > 0)
              if (dirtyParagraphs.length > 0) {
                performAnalysis(dirtyParagraphs)
              }
            }
          }, 50)
        }, 100) // Shorter delay for follow-up analysis
      }
    }
  }, [documentId, apiClient, extractParagraphs, updateParagraphStates])

  // Fixed function that extracts FRESH paragraphs when debounce executes (not when timer is set)
  // NOTE: ESLint warning about missing 'paragraphs' dependency is INTENTIONAL and safe to ignore.
  // We deliberately omit 'paragraphs' from dependencies because:
  // 1. We extract FRESH paragraphs inside this function (not stale state from when timer was set)
  // 2. This fixes the timing issue where last typed character was missing from analysis
  // 3. The old approach caused race conditions - this new approach ensures data integrity
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const analyzeDirtyParagraphs = useCallback(async () => {
    console.log('📊 analyzeDirtyParagraphs called:', {
      documentId: !!documentId,
      apiClient: !!apiClient,
      analysisInProgress: analysisInProgress.current,
      editorAvailable: !!editorRef.current
    })
    
    // CRITICAL FIX: Extract paragraphs INSIDE the debounced function to get fresh state
    if (!editorRef.current) {
      console.warn('⚠️ Editor not available for fresh paragraph extraction')
      return
    }
    
    // Get FRESH paragraphs from current editor state (not stale state from when timer was set)
    console.log('🔄 Extracting FRESH paragraphs from current editor state...')
    const freshParagraphs = extractParagraphs(editorRef.current)
    
    // Update paragraph state with fresh data
    const updatedParagraphs = updateParagraphStates(freshParagraphs)
    
    // Get dirty paragraphs from the freshly extracted data
    const dirtyParagraphs = Array.from(updatedParagraphs.values()).filter(p => p.isDirty && p.content.trim().length > 0)
    
    console.log('📊 Fresh paragraphs extracted:', freshParagraphs.length)
    console.log('📊 Dirty paragraphs found:', dirtyParagraphs.length)
    
    if (dirtyParagraphs.length === 0) {
      console.log('✅ No dirty paragraphs found in fresh extraction')
      return
    }
    
    // Log the content of dirty paragraphs to verify we got the latest text
    dirtyParagraphs.forEach((p, index) => {
      console.log(`📝 Dirty paragraph ${index + 1}: "${p.content.slice(0, 50)}..."`)
    })
    
    // Call the core analysis function with fresh paragraphs
    await performAnalysis(dirtyParagraphs)
  }, [performAnalysis, extractParagraphs, updateParagraphStates, documentId, apiClient])

  // Debounced analysis trigger
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const triggerAnalysis = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      analyzeDirtyParagraphs()
    }, 1000) // 1000ms debounce for better user experience
  }, [analyzeDirtyParagraphs])

  // Handle suggestion click events (Phase 1)
  const handleSuggestionClick = useCallback((suggestion: SuggestionResponse, event: MouseEvent) => {
    console.log('🖱️ Suggestion clicked:', suggestion.original_text)
    
    // Calculate popup position relative to the clicked element
    const rect = (event.target as HTMLElement).getBoundingClientRect()
    const popupX = rect.left + rect.width / 2 // Center horizontally on the clicked text
    
    // Smart positioning: check if popup would go off-screen
    const viewportHeight = window.innerHeight
    const viewportWidth = window.innerWidth
    const popupHeight = 300 // Increased estimate for popup height
    const popupWidth = 512 // Popup width (w-[32rem] = 512px)
    
    // Determine vertical position (below preferred, above only if necessary)
    // Bias towards positioning below to prevent cards from extending past top of screen
    
    let popupY
    let positionAbove = false // Default to below
    
    // Check space available
    const spaceAbove = rect.top
    const spaceBelow = viewportHeight - rect.bottom
    
    console.log(`📏 Space analysis: above=${spaceAbove}px, below=${spaceBelow}px, popupHeight=${popupHeight}px`)
    
    // Prefer positioning below unless there's insufficient space below AND sufficient space above
    if (spaceBelow < popupHeight + 20 && spaceAbove >= popupHeight + 30) {
      // Only position above if below won't fit AND above has good space
      positionAbove = true
      popupY = rect.top
      console.log(`📍 Positioning ABOVE: insufficient space below (${spaceBelow}px) but good space above (${spaceAbove}px)`)
    } else {
      // Position below (default preference)
      positionAbove = false
      popupY = rect.bottom
      console.log(`📍 Positioning BELOW: sufficient space below (${spaceBelow}px) or insufficient space above`)
    }
    
    // Ensure horizontal position doesn't go off-screen
    let adjustedPopupX = popupX
    const halfPopupWidth = popupWidth / 2
    
    if (popupX - halfPopupWidth < 20) { // Too far left
      adjustedPopupX = halfPopupWidth + 20
    } else if (popupX + halfPopupWidth > viewportWidth - 20) { // Too far right
      adjustedPopupX = viewportWidth - halfPopupWidth - 20
    }
    
    console.log(`📍 Popup positioning: clicked at (${rect.left}, ${rect.top}), popup at (${adjustedPopupX}, ${popupY}), ${positionAbove ? 'above' : 'below'}`)
    
    // Set popup state
    setSelectedSuggestion(suggestion)
    setPopupPosition({ 
      x: adjustedPopupX, 
      y: popupY,
      positionAbove 
    })
    setPopupVisible(true)
  }, [])

  // Handle popup close
  const handlePopupClose = useCallback(() => {
    setPopupVisible(false)
    setSelectedSuggestion(null)
  }, [])

  // Handle suggestion accept (Phase 3)
  const handleAcceptSuggestion = useCallback((suggestion: SuggestionResponse) => {
    console.log('✅ Accept suggestion:', suggestion.original_text, '->', suggestion.suggestion_text)
    
    if (!editorRef.current) {
      console.error('Editor not available')
      handlePopupClose()
      return
    }

    const currentEditor = editorRef.current

    try {
      // Step 1: Find valid position for the suggestion text
      const validPosition = findValidSuggestionPosition(currentEditor, suggestion)
      
      if (!validPosition) {
        console.warn('Cannot find valid position for suggestion - text may have changed')
        // TODO: Show user-friendly error message
        handlePopupClose()
        return
      }

      console.log(`🎯 Found valid position for "${suggestion.original_text}" at ${validPosition.start}-${validPosition.end}`)

      // Step 2: Apply text replacement using TipTap transaction
      const success = currentEditor.chain()
        .focus() 
        .setTextSelection({ from: validPosition.start, to: validPosition.end })
        .insertContent(suggestion.suggestion_text)
        .run()

      if (!success) {
        console.error('Failed to apply text replacement')
        // TODO: Show user-friendly error message
        handlePopupClose()
        return
      }

      console.log('✅ Text replacement successful')

      // Step 3: Remove accepted suggestion from state
      setSuggestions(prev => prev.filter(s => s.suggestion_id !== suggestion.suggestion_id))
      
      // TODO: Show success feedback
      console.log('💚 Suggestion accepted and applied!')

    } catch (error) {
      console.error('Error accepting suggestion:', error)
      // TODO: Show user-friendly error message
    } finally {
      // Always close popup
      handlePopupClose()
    }
  }, [handlePopupClose])

  // Handle suggestion dismiss (Phase 4)
  const handleDismissSuggestion = useCallback(async (suggestion: SuggestionResponse) => {
    console.log('❌ Dismiss suggestion:', suggestion.original_text)
    console.log('❌ Suggestion details:', {
      suggestion_id: suggestion.suggestion_id,
      global_start: suggestion.global_start,
      global_end: suggestion.global_end,
      rule_id: suggestion.rule_id,
      original_text: suggestion.original_text
    })
    
    // Guard clause - ensure we have required dependencies
    if (!documentId || !apiClient) {
      console.error('Missing documentId or apiClient for dismiss operation')
      handlePopupClose()
      return
    }

    try {
      // Step 1: Optimistic UI update - remove suggestion immediately for instant feedback
      // Use multiple criteria to find the exact suggestion that was clicked
      setSuggestions(prev => {
        const before = prev.length
        console.log('🔍 Looking for suggestion to remove:', {
          suggestion_id: suggestion.suggestion_id,
          original_text: suggestion.original_text,
          global_start: suggestion.global_start,
          global_end: suggestion.global_end,
          rule_id: suggestion.rule_id
        })
        
        // Log all current suggestions with their positions
        console.log('🔍 Current suggestions before filtering:')
        prev.forEach((s, index) => {
          if (s.original_text === suggestion.original_text) {
            console.log(`  ${index}: "${s.original_text}" at ${s.global_start}-${s.global_end} (id: ${s.suggestion_id})`)
          }
        })
        
        const filtered = prev.filter(s => {
          // Primary match: exact criteria
          const exactMatch = (
            s.suggestion_id === suggestion.suggestion_id &&
            s.global_start === suggestion.global_start &&
            s.global_end === suggestion.global_end &&
            s.original_text === suggestion.original_text &&
            s.rule_id === suggestion.rule_id
          )
          
          // Secondary match: same text and rule, but allow for small position differences (±2 positions)
          // This handles cases where position mapping has caused slight shifts
          const positionTolerance = 2
          const fuzzyMatch = (
            s.original_text === suggestion.original_text &&
            s.rule_id === suggestion.rule_id &&
            Math.abs(s.global_start - suggestion.global_start) <= positionTolerance &&
            Math.abs(s.global_end - suggestion.global_end) <= positionTolerance
          )
          
          const isMatch = exactMatch || fuzzyMatch
          
          if (isMatch) {
            console.log('🎯 Found matching suggestion to remove:', {
              type: exactMatch ? 'exact' : 'fuzzy',
              text: s.original_text,
              position: `${s.global_start}-${s.global_end}`,
              id: s.suggestion_id
            })
          }
          
          return !isMatch
        })
        
        console.log('🔄 Suggestions filtered:', before, '->', filtered.length, '(removed:', before - filtered.length, ')')
        
        // Verify the suggestion was actually removed
        const stillExists = filtered.some(s => 
          s.original_text === suggestion.original_text && 
          s.rule_id === suggestion.rule_id &&
          Math.abs(s.global_start - suggestion.global_start) <= 2
        )
        
        if (stillExists) {
          console.warn('⚠️ Suggestion still exists after filtering! Remaining matches:')
          filtered.forEach((s, index) => {
            if (s.original_text === suggestion.original_text) {
              console.warn(`  ${index}: "${s.original_text}" at ${s.global_start}-${s.global_end} (id: ${s.suggestion_id})`)
            }
          })
        } else {
          console.log('✅ Suggestion successfully removed from state')
        }
        
        return filtered
      })
      
      // Step 2: Close popup immediately
      handlePopupClose()
      
      console.log('🔄 Making dismiss API call...')
      
      // Step 3: Make API call to persist dismissal
      const response = await apiClient.dismissSuggestion({
        document_id: documentId,
        original_text: suggestion.original_text,
        rule_id: suggestion.rule_id
      })

      // Step 4: Success feedback
      if (response.success) {
        console.log('✅ Suggestion dismissed successfully:', response.dismissal_identifier)
        // TODO: Optional success toast notification
      } else {
        console.warn('⚠️ Dismiss API returned success=false, but suggestion already removed from UI')
      }
      
    } catch (error: unknown) {
      // Step 5: Error handling - log error but keep optimistic update
      console.error('❌ Failed to dismiss suggestion via API:', error)
      
      // Determine error type for better logging
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.log('📡 Dismiss request was cancelled')
      } else if (error instanceof Error) {
        if (error.message.includes('HTTP 404')) {
          console.error('📄 Document not found for dismiss operation')
        } else if (error.message.includes('HTTP 5')) {
          console.error('🔥 Server error during dismiss operation')
        } else if (error.message.includes('fetch')) {
          console.error('🌐 Network error during dismiss operation')
        } else {
          console.error('❓ API error during dismiss operation:', error.message)
        }
      } else {
        console.error('❓ Unknown error during dismiss operation')
      }
      
      // Note: We intentionally keep the optimistic update even on error
      // This provides better UX - user sees intended result immediately
      // If dismiss fails, suggestion might reappear in future sessions (acceptable edge case)
      
      // TODO: Optional error toast notification for user feedback
    }
  }, [documentId, apiClient, handlePopupClose])

  // Handle reset dismissed suggestions (Clear dismissed feature)
  const handleResetDismissedSuggestions = useCallback(async () => {
    if (!documentId || !apiClient) {
      console.error('Missing documentId or apiClient for reset operation')
      return
    }

    // Access editor through ref
    const currentEditor = editorRef.current
    if (!currentEditor) {
      console.error('Editor not available for reset operation')
      return
    }

    setIsResetting(true)
    
    try {
      console.log('🔄 Clearing dismissed suggestions for document:', documentId)
      
      // Call API to clear dismissed suggestions
      const response = await apiClient.clearDismissedSuggestions(documentId)
      
      console.log('✅ Dismissed suggestions cleared:', response.message)
      
      // Force full document re-analysis to show previously dismissed suggestions
      console.log('🔄 Triggering full document re-analysis...')
      
      // Mark all paragraphs as dirty to force re-analysis
      const currentParagraphs = extractParagraphs(currentEditor)
      const allDirtyParagraphs = new Map<string, ParagraphState>()
      
      currentParagraphs.forEach(paragraph => {
        allDirtyParagraphs.set(paragraph.id, {
          ...paragraph,
          isDirty: true
        })
      })
      
      setParagraphs(allDirtyParagraphs)
      
      // Clear current suggestions and trigger fresh analysis
      setSuggestions([])
      
      // Trigger analysis with all paragraphs
      if (currentParagraphs.length > 0) {
        await performAnalysis(currentParagraphs)
      }
      
      console.log('✅ Reset dismissed suggestions completed successfully')
      
    } catch (error) {
      console.error('❌ Failed to reset dismissed suggestions:', error)
      
      // Handle different error types for better UX
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.log('📡 Reset request was cancelled')
      } else if (error instanceof Error) {
        if (error.message.includes('404')) {
          console.error('📄 Document not found for reset operation')
        } else if (error.message.includes('500')) {
          console.error('🔥 Server error during reset operation')
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          console.error('🌐 Network error during reset operation')
        } else {
          console.error('❓ API error during reset operation:', error.message)
        }
      } else {
        console.error('❓ Unknown error during reset operation')
      }
      
      // TODO: Optional error toast notification for user feedback
    } finally {
      setIsResetting(false)
      setShowResetDialog(false)
    }
  }, [documentId, apiClient, extractParagraphs, performAnalysis])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Configure paragraph behavior to maintain consistent spacing
        paragraph: {
          HTMLAttributes: {
            class: 'tiptap-paragraph',
          },
        },
        // Configure hard break behavior for better line spacing
        hardBreak: {
          keepMarks: false,
          HTMLAttributes: {
            class: 'tiptap-hard-break',
          },
        },
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      CustomKeyboardShortcuts,
      Placeholder.configure({
        placeholder,
      }),
      // Add SuggestionExtension with live suggestions and click handling
      SuggestionExtension.configure({
        suggestions,
        suggestionClass: 'suggestion-highlight',
        onSuggestionClick: handleSuggestionClick,
      }),
    ],
    content,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onUpdate(editor.getHTML())
      
      // Update readability text with debouncing
      if (onReadabilityTextChange) {
        if (readabilityDebounceRef.current) {
          clearTimeout(readabilityDebounceRef.current)
        }
        
        readabilityDebounceRef.current = setTimeout(() => {
          const text = editor.getText()
          onReadabilityTextChange(text)
        }, 250) // 250ms debounce as recommended in the doc
      }
    },
    // Milestone 3: Enhanced onTransaction for paragraph tracking and stale state management
    onTransaction: ({ editor, transaction }) => {
      // Only process if the document actually changed
      if (!transaction.docChanged) return

      // Check for significant changes during analysis and cancel/restart if needed
      if (analysisInProgress.current && apiCallDocState.current) {
        const currentDocState = editor.state.doc.textContent
        
        if (hasSignificantTextChange(apiCallDocState.current, currentDocState)) {
          console.log('🔄 Significant text change detected during analysis - cancelling and restarting')
          console.log('Original:', apiCallDocState.current.slice(0, 100) + '...')
          console.log('Current:', currentDocState.slice(0, 100) + '...')
          
          // Cancel current analysis
          if (currentAbortController.current) {
            currentAbortController.current.abort()
          }
          
          // Clear analysis state
          analysisInProgress.current = false
          setIsAnalyzing(false)
          pendingTransactions.current = []
          apiCallDocState.current = null
          currentAbortController.current = null
          needsFollowUpAnalysis.current = false // Reset follow-up flag since we're restarting
          
          // Trigger new analysis after a short delay to avoid rapid restarts
          setTimeout(() => {
            triggerAnalysis()
          }, 100)
          
          return // Don't continue with normal transaction processing
        }
        
        // Store transaction if analysis is still in progress (for stale state management)
        pendingTransactions.current.push({
          transaction,
          mapping: transaction.mapping
        })
        
        // Flag that we need follow-up analysis for the new changes
        needsFollowUpAnalysis.current = true
        console.log('🏃‍♂️ Minor change during analysis - flagging for follow-up analysis')
      }

      // CRITICAL FIX: Don't extract paragraphs here (stale state issue)
      // Just trigger analysis - paragraph extraction will happen INSIDE the debounced function
      console.log('📝 Text changed - triggering debounced analysis for fresh state extraction')
      triggerAnalysis()

      // Apply real-time position mapping to existing suggestions (from Milestone 2)
      const updatedSuggestions: SuggestionResponse[] = []
      
      suggestions.forEach(suggestion => {
        try {
          // Map the start and end positions using the transaction mapping
          const oldStart = suggestion.global_start
          const oldEnd = suggestion.global_end
          const newStart = transaction.mapping.map(suggestion.global_start)
          const newEnd = transaction.mapping.map(suggestion.global_end)
          
          console.log(`🔄 Real-time mapping "${suggestion.original_text}": ${oldStart}-${oldEnd} -> ${newStart}-${newEnd}`)
          
          // Check if the suggestion is still valid
          if (isValidSuggestion(suggestion, newStart, newEnd, transaction, editor)) {
            // Double-check the text at the new position with bounds checking
            const docSize = editor.state.doc.content.size
            if (newStart >= 0 && newEnd <= docSize && newStart < newEnd) {
              try {
                const actualText = editor.state.doc.textBetween(newStart, newEnd)
                if (actualText !== suggestion.original_text) {
                  console.log(`  ⚠️ Real-time text mismatch: expected "${suggestion.original_text}", got "${actualText}"`)
                }
                
                updatedSuggestions.push({
                  ...suggestion,
                  global_start: newStart,
                  global_end: newEnd
                })
              } catch (error) {
                console.warn(`  ❌ Failed to read text at ${newStart}-${newEnd}:`, error)
              }
            } else {
              console.log(`  ❌ Invalid bounds after mapping: ${newStart}-${newEnd} (doc size: ${docSize})`)
            }
          } else {
            console.log(`  ❌ Real-time mapping invalidated suggestion`)
          }
        } catch (error) {
          // Invalid suggestion - skip it
          console.warn('Suggestion invalidated:', suggestion.suggestion_id, error)
        }
      })
      
      // Update suggestions state if there are changes
      if (updatedSuggestions.length !== suggestions.length || 
          !suggestionsEqual(updatedSuggestions, suggestions)) {
        setSuggestions(updatedSuggestions)
      }
    },
  })

  // Helper function to check if a suggestion is still valid after an edit (from Milestone 2)
  const isValidSuggestion = (
    originalSuggestion: SuggestionResponse,
    newStart: number,
    newEnd: number,
    transaction: Transaction,
    editor: Editor
  ): boolean => {
    const docSize = editor.state.doc.content.size
    
    // Check if the new positions are within document bounds
    if (newStart < 0 || newEnd > docSize || newStart >= newEnd) {
      console.log(`    🚫 Bounds check failed: ${newStart}-${newEnd} (doc size: ${docSize})`)
      return false
    }

    // Check if the user edited inside the suggestion range
    // Simple heuristic: if the suggestion length changed significantly, it was likely edited
    const originalLength = originalSuggestion.global_end - originalSuggestion.global_start
    const newLength = newEnd - newStart
    
    // If the length changed significantly, the suggestion was likely edited
    if (Math.abs(newLength - originalLength) > 1) {
      console.log(`    🚫 Length check failed: ${originalLength} -> ${newLength} (diff: ${Math.abs(newLength - originalLength)})`)
      return false
    }

    // Additional check: ensure the text content is still reasonable
    try {
      // Double-check bounds before reading text
      const docSize = editor.state.doc.content.size
      if (newStart < 0 || newEnd > docSize || newStart >= newEnd) {
        console.log(`    🚫 Invalid bounds in content check: ${newStart}-${newEnd} (doc size: ${docSize})`)
        return false
      }
      
      const textSlice = editor.state.doc.textBetween(newStart, newEnd)
      const expectedText = originalSuggestion.original_text
      
      // If the text is too short or very different from original, consider it invalidated
      if (textSlice.length < 2 || !textSlice.includes(expectedText.slice(0, 3))) {
        console.log(`    🚫 Content check failed: expected "${expectedText}", got "${textSlice}"`)
        return false
      }
      
      console.log(`    ✅ Validation passed for "${expectedText}" -> "${textSlice}"`)
    } catch (error) {
      console.log(`    🚫 Exception during text validation:`, error)
      return false
    }

    return true
  }

  // Helper function to compare suggestion arrays (from Milestone 2)
  const suggestionsEqual = (a: SuggestionResponse[], b: SuggestionResponse[]): boolean => {
    if (a.length !== b.length) return false
    
    for (let i = 0; i < a.length; i++) {
      if (a[i].suggestion_id !== b[i].suggestion_id || 
          a[i].global_start !== b[i].global_start || 
          a[i].global_end !== b[i].global_end) {
        return false
      }
    }
    
    return true
  }

  // Helper function to find valid position for suggestion (Phase 3)
  const findValidSuggestionPosition = (editor: Editor, suggestion: SuggestionResponse) => {
    if (!editor) return null

    const doc = editor.state.doc
    const originalStart = suggestion.global_start
    const originalEnd = suggestion.global_end

    // Step 1: Check if original position is still valid
    if (originalStart >= 0 && originalEnd <= doc.content.size && originalStart < originalEnd) {
      try {
        const currentText = doc.textBetween(originalStart, originalEnd)
        if (currentText === suggestion.original_text) {
          return { start: originalStart, end: originalEnd }
        }
      } catch (error) {
        console.warn('Error reading text at original position:', error)
      }
    }

    // Step 2: Search within ±5 characters for the correct position
    const searchRange = 5
    for (let offset = -searchRange; offset <= searchRange; offset++) {
      const testStart = originalStart + offset
      const testEnd = originalEnd + offset

      // Ensure we're within document bounds
      if (testStart >= 0 && testEnd <= doc.content.size && testStart < testEnd) {
        try {
          const testText = doc.textBetween(testStart, testEnd)
          if (testText === suggestion.original_text) {
            console.log(`🎯 Found suggestion text at offset ${offset}`)
            return { start: testStart, end: testEnd }
          }
        } catch {
          // Skip invalid positions
          continue
        }
      }
    }

    // Step 3: No valid position found
    console.warn(`Could not find valid position for "${suggestion.original_text}"`)
    return null
  }

  // Store editor reference and notify parent when editor is ready
  useEffect(() => {
    editorRef.current = editor
    if (editor && onEditorReady) {
      onEditorReady(editor)
    }
  }, [editor, onEditorReady])

  // Initialize readability text when editor is available
  useEffect(() => {
    if (editor && onReadabilityTextChange) {
      const text = editor.getText()
      onReadabilityTextChange(text)
    }
  }, [editor, onReadabilityTextChange])

  // Cleanup: Cancel any ongoing analysis when component unmounts
  useEffect(() => {
    return () => {
      if (currentAbortController.current) {
        currentAbortController.current.abort()
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
      if (readabilityDebounceRef.current) {
        clearTimeout(readabilityDebounceRef.current)
      }
    }
  }, [])

  // Update extension when suggestions change
  useEffect(() => {
    if (editor) {
      // Force update of the suggestion extension with new suggestions
      const suggestionExtension = editor.extensionManager.extensions.find(
        (ext) => ext.name === 'suggestions'
      )
      
      if (suggestionExtension) {
        suggestionExtension.options.suggestions = suggestions
        
        // Force a re-render of decorations by dispatching an empty transaction
        const { tr } = editor.state
        editor.view.dispatch(tr)
      }
    }
  }, [suggestions, editor])

  // Sync content when it changes externally
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, false)
    }
  }, [editor, content])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [])

  // Initial analysis when document is first opened
  useEffect(() => {
    console.log('🔍 Initial analysis useEffect check:', {
      editor: !!editor,
      documentId,
      hasContent: !!(content && content.trim()),
      hasInitialAnalysisRun: hasInitialAnalysisRun.current
    })
    
    // Only run for documents with actual IDs (not empty strings for new documents)
    if (editor && documentId && documentId !== '' && content && content.trim() && !hasInitialAnalysisRun.current) {
      console.log('🚀 Triggering initial analysis for document', documentId)
      
      // Mark that initial analysis has started to prevent loops
      hasInitialAnalysisRun.current = true
      
      // Small delay to ensure editor is fully initialized
      const initialAnalysisTimeout = setTimeout(() => {
        // Check if editor still has content (might have changed during delay)
        const currentContent = editor.state.doc.textContent
        if (!currentContent || !currentContent.trim()) {
          console.log('⏭️ Skipping initial analysis - no content')
          hasInitialAnalysisRun.current = false // Reset flag so it can run later
          return
        }
        
        // Trigger initial analysis using fresh paragraph extraction
        console.log('🚀 Triggering initial analysis with fresh extraction approach')
        
        if (debounceTimeoutRef.current) {
          clearTimeout(debounceTimeoutRef.current)
        }
        
        // Use the same fresh extraction approach for initial analysis
        debounceTimeoutRef.current = setTimeout(() => {
          console.log('🔄 Initial analysis: calling analyzeDirtyParagraphs with fresh extraction')
          analyzeDirtyParagraphs()
        }, 500)
      }, 1000) // Increased delay to 1 second to ensure editor is stable
      
      return () => {
        clearTimeout(initialAnalysisTimeout)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, documentId])

  // Reset initial analysis flag when document changes
  useEffect(() => {
    hasInitialAnalysisRun.current = false
  }, [documentId])

  if (!editor) {
    return null
  }

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      {/* Toolbar */}
      <div className="border-b border-gray-200 p-2 flex flex-wrap gap-1">
        <Button
          type="button"
          variant={editor.isActive('bold') ? 'default' : 'outline'}
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
        >
          Bold
        </Button>
        
        <Button
          type="button"
          variant={editor.isActive('italic') ? 'default' : 'outline'}
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
        >
          Italic
        </Button>

        <Button
          type="button"
          variant={editor.isActive('strike') ? 'default' : 'outline'}
          size="sm"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={!editor.can().chain().focus().toggleStrike().run()}
        >
          Strike
        </Button>

        <div className="w-px bg-gray-300 mx-1" />

        <Button
          type="button"
          variant={editor.isActive('heading', { level: 1 }) ? 'default' : 'outline'}
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          H1
        </Button>

        <Button
          type="button"
          variant={editor.isActive('heading', { level: 2 }) ? 'default' : 'outline'}
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </Button>

        <Button
          type="button"
          variant={editor.isActive('heading', { level: 3 }) ? 'default' : 'outline'}
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </Button>

        <div className="w-px bg-gray-300 mx-1" />

        <Button
          type="button"
          variant={editor.isActive('bulletList') ? 'default' : 'outline'}
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          Bullet List
        </Button>

        <Button
          type="button"
          variant={editor.isActive('orderedList') ? 'default' : 'outline'}
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          Numbered List
        </Button>

        <div className="w-px bg-gray-300 mx-1" />

        <Button
          type="button"
          variant={editor.isActive('blockquote') ? 'default' : 'outline'}
          size="sm"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          Quote
        </Button>

        <Button
          type="button"
          variant={editor.isActive('codeBlock') ? 'default' : 'outline'}
          size="sm"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          Code Block
        </Button>

        <div className="w-px bg-gray-300 mx-1" />

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
        >
          Undo
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
        >
          Redo
        </Button>
        
        <div className="flex-1" />
        
        <div className="text-xs text-gray-500 flex items-center">
          <span>Enter: New paragraph • Shift+Enter: Line break</span>
        </div>
        
        {/* Status indicators for Milestone 3 */}
        <div className="ml-4 text-xs flex items-center gap-3">
          <span className={`${isAnalyzing ? 'text-blue-600' : 'text-green-600'}`}>
            {isAnalyzing ? '🔄 Analyzing...' : `✨ ${suggestions.length} suggestions`}
          </span>
          {analysisErrors.length > 0 && (
            <span className="text-red-600" title={analysisErrors.join(', ')}>
              ⚠️ {analysisErrors.length} errors
            </span>
          )}
          
          {/* Reset Dismissed Suggestions Button */}
          {documentId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowResetDialog(true)}
              disabled={isResetting || isAnalyzing}
              className="ml-2"
            >
              {isResetting ? '🔄 Resetting...' : 'Reset Suggestion Dismissals'}
            </Button>
          )}


        </div>
      </div>

      {/* Editor Content */}
      <div className="p-4">
        <div className="editor-content">
          <EditorContent 
            editor={editor} 
            className="prose prose-sm max-w-none focus:outline-none"
          />
        </div>
      </div>
      
      <style jsx global>{`
        .editor-content .ProseMirror {
          outline: none !important;
          line-height: 1.6 !important;
        }
        
        /* Paragraph styling - reduce margins for consistent spacing */
        .editor-content .ProseMirror p {
          margin: 0 0 0.75rem 0 !important;
          line-height: 1.6 !important;
        }
        
        .editor-content .ProseMirror p:first-child {
          margin-top: 0 !important;
        }
        
        .editor-content .ProseMirror p:last-child {
          margin-bottom: 0 !important;
        }
        
        /* Hard break styling - minimal spacing for single line breaks */
        .editor-content .ProseMirror br.tiptap-hard-break {
          content: "";
          display: block;
          margin: 0 !important;
          padding: 0 !important;
          line-height: 0.3 !important;
        }
        
        /* Empty paragraphs should have minimal height */
        .editor-content .ProseMirror p:empty {
          margin: 0 0 0.3rem 0 !important;
          min-height: 1em !important;
        }
        
        /* Consecutive empty paragraphs */
        .editor-content .ProseMirror p:empty + p:empty {
          margin-top: 0 !important;
        }
        
        /* Heading styles */
        .editor-content .ProseMirror h1,
        .editor-content .ProseMirror h2,
        .editor-content .ProseMirror h3 {
          margin: 1.5rem 0 0.75rem 0 !important;
          line-height: 1.3 !important;
        }
        
        .editor-content .ProseMirror h1:first-child,
        .editor-content .ProseMirror h2:first-child,
        .editor-content .ProseMirror h3:first-child {
          margin-top: 0 !important;
        }
        
        /* List styling */
        .editor-content .ProseMirror ul,
        .editor-content .ProseMirror ol {
          margin: 0.5rem 0 !important;
          padding-left: 1.5rem !important;
        }
        
        .editor-content .ProseMirror li {
          margin: 0.25rem 0 !important;
        }
        
        /* Blockquote styling */
        .editor-content .ProseMirror blockquote {
          margin: 1rem 0 !important;
          padding-left: 1rem !important;
          border-left: 3px solid #d1d5db !important;
          color: #6b7280 !important;
        }
        
        /* Code block styling */
        .editor-content .ProseMirror pre {
          margin: 1rem 0 !important;
          padding: 0.75rem !important;
          background-color: #f3f4f6 !important;
          border-radius: 0.375rem !important;
          overflow-x: auto !important;
        }
        
        .editor-content .ProseMirror code {
          background-color: #f3f4f6 !important;
          padding: 0.125rem 0.25rem !important;
          border-radius: 0.25rem !important;
          font-size: 0.875em !important;
        }

        /* Suggestion highlight styling - Base styles */
        .suggestion-highlight {
          border-radius: 2px !important;
          cursor: pointer !important;
          transition: background-color 0.2s ease !important;
          border-bottom: 2px solid !important;
        }
        
        /* Grammar suggestions - Blue theme */
        .suggestion-highlight-grammar {
          background-color: #eff6ff !important;
          border-bottom-color: #3b82f6 !important;
        }
        
        .suggestion-highlight-grammar:hover {
          background-color: #dbeafe !important;
        }
        
        /* Spelling suggestions - Red theme */
        .suggestion-highlight-spelling {
          background-color: #fef2f2 !important;
          border-bottom-color: #ef4444 !important;
        }
        
        .suggestion-highlight-spelling:hover {
          background-color: #fecaca !important;
        }
        
        /* Style suggestions - Green theme */
        .suggestion-highlight-style {
          background-color: #f0fdf4 !important;
          border-bottom-color: #22c55e !important;
        }
        
        .suggestion-highlight-style:hover {
          background-color: #dcfce7 !important;
        }
      `}</style>

      {/* Suggestion Popup (Phase 2) */}
      <SuggestionPopup
        suggestion={selectedSuggestion}
        isVisible={popupVisible}
        position={popupPosition}
        onAccept={handleAcceptSuggestion}
        onDismiss={handleDismissSuggestion}
        onClose={handlePopupClose}
      />
      
      {/* Reset Dismissed Suggestions Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Suggestion Dismissals</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear all dismissed suggestions for this document, allowing them to appear again. 
              The document will be re-analyzed to show previously dismissed suggestions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResetting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetDismissedSuggestions}
              disabled={isResetting}
            >
              {isResetting ? 'Resetting...' : 'Reset Dismissals'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
} 