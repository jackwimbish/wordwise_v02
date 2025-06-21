'use client'

import { useState } from 'react'
import { TiptapEditor } from '@/components/editor/TiptapEditor'
import { Navbar } from '@/components/navigation/Navbar'

export default function EditorTestPage() {
  // Test content designed to trigger highlights at positions 25-32 and 50-55
  const [content, setContent] = useState('<p>This is sample text to test the real-time highlight system.</p>')

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            TipTap Editor Test - Milestone 2: Real-time Highlights
          </h1>
          
          {/* Testing Instructions */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h2 className="text-lg font-semibold text-blue-900 mb-2">Testing Instructions for Milestone 2</h2>
            <div className="text-sm text-blue-800 space-y-2">
              <p><strong>Expected highlights:</strong></p>
              <ul className="list-disc ml-5 space-y-1">
                <li>Characters 25-32: &quot;to test&quot; (should be highlighted)</li>
                <li>Characters 50-55: &quot;light&quot; (should be highlighted)</li>
              </ul>
              <p><strong>Test scenarios:</strong></p>
              <ul className="list-disc ml-5 space-y-1">
                <li>✅ Type text BEFORE a highlight → highlight should move with text</li>
                <li>✅ Type text INSIDE a highlight → highlight should disappear</li>
                <li>✅ Delete text BEFORE a highlight → highlight should move backwards</li>
                <li>✅ Delete a highlighted word → highlight should disappear</li>
              </ul>
            </div>
          </div>
          
          <div className="space-y-6">
            <TiptapEditor
              content={content}
              onUpdate={setContent}
              placeholder="Test the dynamic highlighting by typing before and inside the yellow highlights..."
              documentId="test-document-id"
            />
            
            {/* Character position guide */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h3 className="text-lg font-semibold mb-2">Character Position Guide:</h3>
              <div className="font-mono text-sm">
                <div className="mb-2">Current content length: {content.replace(/<[^>]*>/g, '').length} characters</div>
                <div className="text-xs text-gray-600 break-all">
                  {content.replace(/<[^>]*>/g, '').split('').map((char, index) => (
                    <span 
                      key={index} 
                      className={`${
                        (index >= 25 && index < 32) || (index >= 50 && index < 55) 
                          ? 'bg-yellow-200 font-bold' 
                          : ''
                      }`}
                      title={`Position ${index}`}
                    >
                      {char === ' ' ? '·' : char}
                    </span>
                  ))}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  · = space, yellow = expected highlight positions
                </div>
              </div>
            </div>
            
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