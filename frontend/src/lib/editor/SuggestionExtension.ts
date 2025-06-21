import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { Node } from '@tiptap/pm/model'
import type { SuggestionResponse } from '@/types'

/**
 * SuggestionExtension - Custom TipTap extension for AI-powered writing suggestions
 * 
 * This extension handles rendering suggestion highlights (decorations) 
 * based on suggestion data from the backend API.
 * 
 * Features:
 * - Dynamic suggestion highlighting using ProseMirror decorations
 * - Non-content-altering overlays for visual feedback
 * - Support for multiple concurrent suggestions
 * - Backend integration for real-time AI suggestions
 */

export interface SuggestionOptions {
  suggestions: SuggestionResponse[]
  suggestionClass: string
}

const suggestionPluginKey = new PluginKey('suggestions')

// Helper function to create decorations
function createDecorations(doc: Node, suggestions: SuggestionResponse[], suggestionClass: string): DecorationSet {
  const decorations: Decoration[] = []
  
  // Create decorations for suggestions
  
  suggestions.forEach(suggestion => {
    // Ensure the suggestion range is valid within the document
    if (suggestion.global_start >= 0 && 
        suggestion.global_end <= doc.content.size && 
        suggestion.global_start < suggestion.global_end) {
      
            try {
        // Find the correct position by testing different offsets around the expected position
        let finalStart = suggestion.global_start
        let finalEnd = suggestion.global_end
        let foundCorrectPosition = false
        
        // First check if the original position is already correct
        let testText = doc.textBetween(finalStart, finalEnd)
        if (testText === suggestion.original_text) {
          foundCorrectPosition = true
        } else {
          // Search in a range around the expected position for the correct text
          const searchRange = 5 // Search ±5 positions
          
          for (let offset = -searchRange; offset <= searchRange && !foundCorrectPosition; offset++) {
            const testStart = suggestion.global_start + offset
            const testEnd = suggestion.global_end + offset
            
            // Ensure we're within document bounds
            if (testStart >= 0 && testEnd <= doc.content.size && testStart < testEnd) {
              try {
                testText = doc.textBetween(testStart, testEnd)
                if (testText === suggestion.original_text) {
                  finalStart = testStart
                  finalEnd = testEnd
                  foundCorrectPosition = true
                  if (offset !== 0) {
                    console.log(`🎯 Found correct position for "${suggestion.original_text}" at offset ${offset}: ${finalStart}-${finalEnd}`)
                  }
                }
                             } catch {
                 // Skip invalid positions
               }
            }
          }
          
          if (!foundCorrectPosition) {
            console.warn(`⚠️ Could not find correct position for "${suggestion.original_text}" near ${suggestion.global_start}-${suggestion.global_end}`)
          }
        }
         
         // Validate the final range
         if (finalStart < 0 || finalEnd > doc.content.size || finalStart >= finalEnd) {
           console.warn(`⚠️ Invalid final range for "${suggestion.original_text}": ${finalStart}-${finalEnd}, using original positions`)
           finalStart = suggestion.global_start
           finalEnd = suggestion.global_end
         }
         
         // Create inline decoration for highlighting the text range
        const decoration = Decoration.inline(
          finalStart,
          finalEnd,
          {
            class: suggestionClass,
            'data-suggestion-id': suggestion.suggestion_id,
            'data-suggestion-message': suggestion.message,
            'data-rule-id': suggestion.rule_id,
            'data-category': suggestion.category,
            'data-original-text': suggestion.original_text,
            'data-suggestion-text': suggestion.suggestion_text,
          }
        )
        decorations.push(decoration)
      } catch (error) {
        // Silently handle invalid ranges
        console.warn('Invalid suggestion range:', suggestion, error)
      }
    } else {
      console.log(`🚫 Skipping invalid suggestion range: ${suggestion.global_start}-${suggestion.global_end} (doc size: ${doc.content.size})`)
    }
  })
  
  // Return decoration set
  return DecorationSet.create(doc, decorations)
}

export const SuggestionExtension = Extension.create<SuggestionOptions>({
  name: 'suggestions',
  
  addOptions() {
    return {
      suggestions: [],
      suggestionClass: 'suggestion-highlight',
    }
  },

  addProseMirrorPlugins() {
    const extensionOptions = this.options
    
    return [
      new Plugin({
        key: suggestionPluginKey,
        
        state: {
          init(_, { doc }) {
            return createDecorations(doc, extensionOptions.suggestions, extensionOptions.suggestionClass)
          },
          
          apply(transaction, decorationSet, oldState, newState) {
            // Get current suggestions from options
            const suggestions = extensionOptions.suggestions || []
            
            // Create new decorations based on current suggestions
            return createDecorations(newState.doc, suggestions, extensionOptions.suggestionClass)
          },
        },
        
        props: {
          decorations(state) {
            return this.getState(state)
          },
        },
      }),
    ]
  },

  onCreate() {
    console.log('SuggestionExtension initialized with backend API support')
  },
}) 