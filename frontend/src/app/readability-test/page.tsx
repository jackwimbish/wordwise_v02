'use client'

import { ReadabilityScore } from '@/components/editor/ReadabilityScore'
import { PageCount } from '@/components/editor/PageCount'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function ReadabilityTestPage() {
  const [sampleText, setSampleText] = useState(`
    Playing games has always been thought to be important to the development of well-balanced and creative children; however, what part, if any, they should play in the lives of adults has never been researched that deeply. I believe that playing games is every bit as important for adults as for children. Not only is taking time out to play games with our children and other adults valuable to building interpersonal relationships but is also a wonderful way to release built up tension.
  `.trim())

  return (
    <div className="container mx-auto p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Readability Score Test</h1>
        <p className="text-muted-foreground">
          Test the readability scoring functionality with different text samples.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Text Input */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Sample Text</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                value={sampleText}
                onChange={(e) => setSampleText(e.target.value)}
                className="w-full h-64 p-3 border rounded-md resize-none"
                placeholder="Enter text to analyze..."
              />
              
              <div className="mt-4 space-y-2">
                <button
                  onClick={() => setSampleText("The cat sat on the mat. It was a sunny day.")}
                  className="block w-full p-2 text-left bg-gray-100 hover:bg-gray-200 rounded text-sm"
                >
                  Simple Text (Easy)
                </button>
                <button
                  onClick={() => setSampleText("The implementation of sophisticated algorithms necessitates comprehensive understanding of computational complexity theory and its practical applications in enterprise-level software architecture.")}
                  className="block w-full p-2 text-left bg-gray-100 hover:bg-gray-200 rounded text-sm"
                >
                  Complex Text (Difficult)
                </button>
                <button
                  onClick={() => setSampleText("Playing games has always been thought to be important to the development of well-balanced and creative children; however, what part, if any, they should play in the lives of adults has never been researched that deeply. I believe that playing games is every bit as important for adults as for children. Not only is taking time out to play games with our children and other adults valuable to building interpersonal relationships but is also a wonderful way to release built up tension.")}
                  className="block w-full p-2 text-left bg-gray-100 hover:bg-gray-200 rounded text-sm"
                >
                  Sample Text (Standard)
                </button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Readability Score */}
        <div>
          <ReadabilityScore text={sampleText} />
        </div>

        {/* Page Count */}
        <div>
          <PageCount text={sampleText} />
        </div>
      </div>
    </div>
  )
} 