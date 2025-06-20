'use client'

import { useState } from 'react'
import { TiptapEditor } from '@/components/editor/TiptapEditor'
import { Navbar } from '@/components/navigation/Navbar'

export default function EditorTestPage() {
  const [content, setContent] = useState('<p>Hello world! This is a test of the TipTap editor.</p>')

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            TipTap Editor Test
          </h1>
          
          <div className="space-y-6">
            <TiptapEditor
              content={content}
              onUpdate={setContent}
              placeholder="Start writing your test content..."
            />
            
            {/* Preview of raw HTML content */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h3 className="text-lg font-semibold mb-2">Raw HTML Output:</h3>
              <pre className="text-sm bg-white p-3 rounded border overflow-auto">
                {content}
              </pre>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 