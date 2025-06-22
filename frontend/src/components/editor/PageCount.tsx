'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface PageCountSettings {
  fontFamily: string
  fontSize: number
  paperSize: string
  lineSpacing: string
  margins: string
}

interface PageCountProps {
  text: string
}

interface PaperSize {
  width: number
  height: number
}

interface FontCharacteristics {
  charsPerInch: number
  lineHeight: number
}

export function PageCount({ text }: PageCountProps) {
  const [settings, setSettings] = useState<PageCountSettings>({
    fontFamily: 'times',
    fontSize: 12,
    paperSize: 'letter',
    lineSpacing: 'double',
    margins: '1inch'
  })

  const [pageCount, setPageCount] = useState(0)

  const calculatePageCount = useCallback((text: string, settings: PageCountSettings): number => {
    if (!text || text.trim().length === 0) return 0

    // Paper size definitions (in inches)
    const paperSizes: Record<string, PaperSize> = {
      letter: { width: 8.5, height: 11 },
      a4: { width: 8.27, height: 11.69 },
      legal: { width: 8.5, height: 14 }
    }

    // Font characteristics
    const fontCharacteristics: Record<string, FontCharacteristics> = {
      times: { charsPerInch: 12, lineHeight: 1.2 },
      arial: { charsPerInch: 11, lineHeight: 1.2 },
      calibri: { charsPerInch: 11.5, lineHeight: 1.2 },
      helvetica: { charsPerInch: 11, lineHeight: 1.2 }
    }

    // Margin definitions (in inches)
    const marginSizes: Record<string, number> = {
      '0.5inch': 0.5,
      '1inch': 1,
      '1.5inch': 1.5
    }

    // Line spacing multipliers
    const lineSpacingMultipliers: Record<string, number> = {
      single: 1,
      '1.5': 1.5,
      double: 2
    }

    const paper = paperSizes[settings.paperSize]
    const font = fontCharacteristics[settings.fontFamily]
    const marginSize = marginSizes[settings.margins]
    const spacingMultiplier = lineSpacingMultipliers[settings.lineSpacing]

    // Calculate usable page dimensions
    const usableWidth = paper.width - (marginSize * 2)
    const usableHeight = paper.height - (marginSize * 2)

    // Calculate characters per line
    const baseCharsPerInch = font.charsPerInch
    // Adjust for font size (12pt is baseline)
    const fontSizeMultiplier = 12 / settings.fontSize
    const adjustedCharsPerInch = baseCharsPerInch * fontSizeMultiplier
    const charsPerLine = Math.floor(usableWidth * adjustedCharsPerInch)

    // Calculate lines per page
    const baseLineHeight = (settings.fontSize / 72) * font.lineHeight // Convert pt to inches
    const adjustedLineHeight = baseLineHeight * spacingMultiplier
    const linesPerPage = Math.floor(usableHeight / adjustedLineHeight)

    // Calculate characters per page
    const charsPerPage = charsPerLine * linesPerPage

    // Count characters (excluding excessive whitespace)
    const cleanText = text.replace(/\s+/g, ' ').trim()
    const totalChars = cleanText.length

    // Calculate page count
    const estimatedPages = totalChars / charsPerPage

    return Math.max(estimatedPages, 0)
  }, [])

  useEffect(() => {
    const count = calculatePageCount(text, settings)
    setPageCount(count)
  }, [text, settings, calculatePageCount])

  const updateSetting = <K extends keyof PageCountSettings>(
    key: K,
    value: PageCountSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">Page Count Estimate</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primary Page Count Display */}
        <div className="p-3 bg-muted rounded-lg text-center">
          <div className="text-2xl font-bold text-blue-600">
            {pageCount < 0.1 && text.trim() 
              ? '<0.1' 
              : pageCount.toFixed(1)
            }
          </div>
          <div className="text-sm text-muted-foreground">
            {pageCount === 1 ? 'page' : 'pages'}
          </div>
        </div>

        {/* Settings */}
        <div className="space-y-3">
          {/* Font Family */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Font Family</label>
            <select
              value={settings.fontFamily}
              onChange={(e) => updateSetting('fontFamily', e.target.value)}
              className="w-full mt-1 p-2 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="times">Times New Roman</option>
              <option value="arial">Arial</option>
              <option value="calibri">Calibri</option>
              <option value="helvetica">Helvetica</option>
            </select>
          </div>

          {/* Font Size */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Font Size</label>
            <select
              value={settings.fontSize.toString()}
              onChange={(e) => updateSetting('fontSize', parseInt(e.target.value))}
              className="w-full mt-1 p-2 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="10">10pt</option>
              <option value="11">11pt</option>
              <option value="12">12pt</option>
              <option value="14">14pt</option>
              <option value="16">16pt</option>
              <option value="18">18pt</option>
            </select>
          </div>

          {/* Paper Size */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Paper Size</label>
            <select
              value={settings.paperSize}
              onChange={(e) => updateSetting('paperSize', e.target.value)}
              className="w-full mt-1 p-2 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="letter">US Letter (8.5×11&quot;)</option>
              <option value="a4">A4 (8.27×11.69&quot;)</option>
              <option value="legal">US Legal (8.5×14&quot;)</option>
            </select>
          </div>

          {/* Line Spacing */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Line Spacing</label>
            <select
              value={settings.lineSpacing}
              onChange={(e) => updateSetting('lineSpacing', e.target.value)}
              className="w-full mt-1 p-2 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="single">Single</option>
              <option value="1.5">1.5 Lines</option>
              <option value="double">Double</option>
            </select>
          </div>

          {/* Margins */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Margins</label>
            <select
              value={settings.margins}
              onChange={(e) => updateSetting('margins', e.target.value)}
              className="w-full mt-1 p-2 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="0.5inch">0.5 inch</option>
              <option value="1inch">1 inch</option>
              <option value="1.5inch">1.5 inch</option>
            </select>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="pt-2 border-t">
          <div className="text-xs text-muted-foreground space-y-1">
            <div>
              Characters: {text.replace(/\s+/g, ' ').trim().length.toLocaleString()}
            </div>
            <div className="italic">
              * Estimates based on standard formatting
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 