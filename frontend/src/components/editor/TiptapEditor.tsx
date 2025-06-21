'use client'

import { useEffect, useState, useRef } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Extension } from '@tiptap/core'
import { Transaction } from '@tiptap/pm/state'
import { Button } from '@/components/ui/button'
import { SuggestionExtension, type Suggestion } from '@/lib/editor/SuggestionExtension'

interface TiptapEditorProps {
  content: string
  onUpdate: (content: string) => void
  placeholder?: string
  editable?: boolean
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

export function TiptapEditor({ 
  content, 
  onUpdate, 
  placeholder = 'Start writing...', 
  editable = true 
}: TiptapEditorProps) {
  // Mutable suggestions for Milestone 2 - can be updated via position mapping
  const [suggestions, setSuggestions] = useState<Suggestion[]>([
    { id: 'test-1', start: 25, end: 32, message: 'Test Highlight 1' },
    { id: 'test-2', start: 50, end: 55, message: 'Test Highlight 2' }
  ])

  // Track the current editor instance for dynamic updates
  const editorRef = useRef<typeof editor>(null)

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
      // Add SuggestionExtension with dynamic suggestions
      SuggestionExtension.configure({
        suggestions,
        suggestionClass: 'suggestion-highlight',
      }),
    ],
    content,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onUpdate(editor.getHTML())
    },
    // Milestone 2: Add onTransaction callback for real-time highlight transformation
    onTransaction: ({ editor, transaction }) => {
      // Only process if the document actually changed
      if (!transaction.docChanged) return

      // Map suggestion positions to their new locations after the edit
      const updatedSuggestions: Suggestion[] = []
      
      suggestions.forEach(suggestion => {
        try {
          // Map the start and end positions using the transaction mapping
          const newStart = transaction.mapping.map(suggestion.start)
          const newEnd = transaction.mapping.map(suggestion.end)
          
          // Check if the suggestion is still valid
          if (isValidSuggestion(suggestion, newStart, newEnd, transaction, editor)) {
            updatedSuggestions.push({
              ...suggestion,
              start: newStart,
              end: newEnd
            })
          }
        } catch (error) {
          // Invalid suggestion - skip it
          console.warn('Suggestion invalidated:', suggestion.id, error)
        }
      })
      
      // Update suggestions state if there are changes
      if (updatedSuggestions.length !== suggestions.length || 
          !suggestionsEqual(updatedSuggestions, suggestions)) {
        setSuggestions(updatedSuggestions)
      }
    },
  })

  // Helper function to check if a suggestion is still valid after an edit
  const isValidSuggestion = (
    originalSuggestion: Suggestion,
    newStart: number,
    newEnd: number,
    transaction: Transaction,
    editor: Editor
  ): boolean => {
    // Check if the new positions are within document bounds
    if (newStart < 0 || newEnd > editor.state.doc.content.size || newStart >= newEnd) {
      return false
    }

    // Check if the user edited inside the suggestion range
    // We do this by checking if the mapped range is significantly different from expected
    const originalLength = originalSuggestion.end - originalSuggestion.start
    const newLength = newEnd - newStart
    
    // If the length changed significantly, the suggestion was likely edited
    // Also check if the positions shifted by more than the expected amount
    const positionShift = newStart - originalSuggestion.start
    const expectedShift = transaction.mapping.map(0) - 0 // Get the general offset
    
    // Simple heuristic: if the suggestion length changed or positions are inconsistent
    if (Math.abs(newLength - originalLength) > 0 || Math.abs(positionShift - expectedShift) > 1) {
      // Additional check: ensure the text content is still reasonable
      try {
        const textSlice = editor.state.doc.textBetween(newStart, newEnd)
        // If the text is too short or empty, consider it invalidated
        if (textSlice.length < 2) {
          return false
        }
      } catch {
        return false
      }
    }

    return true
  }

  // Helper function to compare suggestion arrays
  const suggestionsEqual = (a: Suggestion[], b: Suggestion[]): boolean => {
    if (a.length !== b.length) return false
    
    for (let i = 0; i < a.length; i++) {
      if (a[i].id !== b[i].id || a[i].start !== b[i].start || a[i].end !== b[i].end) {
        return false
      }
    }
    
    return true
  }

  // Store editor reference for potential future use
  useEffect(() => {
    editorRef.current = editor
  }, [editor])

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
        
        {/* Debug info for Milestone 2 */}
        <div className="ml-4 text-xs text-blue-600 flex items-center">
          <span>Active suggestions: {suggestions.length}</span>
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

        /* Suggestion highlight styling */
        .suggestion-highlight {
          background-color: #fef3c7 !important;
          border-bottom: 2px solid #f59e0b !important;
          border-radius: 2px !important;
          cursor: pointer !important;
          transition: background-color 0.2s ease !important;
        }
        
        .suggestion-highlight:hover {
          background-color: #fde68a !important;
        }
      `}</style>
    </div>
  )
} 