import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Page calculation utilities for shared use between components
export interface PageCountSettings {
  fontFamily: string
  fontSize: number
  paperSize: string
  lineSpacing: string
  margins: string
}

export interface PaperSize {
  width: number
  height: number
}

export interface FontCharacteristics {
  charsPerInch: number
  lineHeight: number
}

// Default page settings
export const DEFAULT_PAGE_SETTINGS: PageCountSettings = {
  fontFamily: 'times',
  fontSize: 12,
  paperSize: 'letter',
  lineSpacing: 'double',
  margins: '1inch'
}

// Paper size definitions (in inches)
export const PAPER_SIZES: Record<string, PaperSize> = {
  letter: { width: 8.5, height: 11 },
  a4: { width: 8.27, height: 11.69 },
  legal: { width: 8.5, height: 14 }
}

// Font characteristics
export const FONT_CHARACTERISTICS: Record<string, FontCharacteristics> = {
  times: { charsPerInch: 12, lineHeight: 1.2 },
  arial: { charsPerInch: 11, lineHeight: 1.2 },
  calibri: { charsPerInch: 11.5, lineHeight: 1.2 },
  helvetica: { charsPerInch: 11, lineHeight: 1.2 }
}

// Margin definitions (in inches)
export const MARGIN_SIZES: Record<string, number> = {
  '0.5inch': 0.5,
  '1inch': 1,
  '1.5inch': 1.5
}

// Line spacing multipliers
export const LINE_SPACING_MULTIPLIERS: Record<string, number> = {
  single: 1,
  '1.5': 1.5,
  double: 2
}

/**
 * Calculate the number of characters that fit on a single page
 * based on the given page settings
 */
export function calculateCharactersPerPage(settings: PageCountSettings): number {
  const paper = PAPER_SIZES[settings.paperSize]
  const font = FONT_CHARACTERISTICS[settings.fontFamily]
  const marginSize = MARGIN_SIZES[settings.margins]
  const spacingMultiplier = LINE_SPACING_MULTIPLIERS[settings.lineSpacing]

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

  return Math.max(charsPerPage, 1) // Ensure at least 1 character per page
}

/**
 * Calculate the number of pages for given text and settings
 */
export function calculatePageCount(text: string, settings: PageCountSettings): number {
  if (!text || text.trim().length === 0) return 0

  const charsPerPage = calculateCharactersPerPage(settings)
  
  // Count characters (excluding excessive whitespace, same as backend)
  const cleanText = text.replace(/\s+/g, ' ').trim()
  const totalChars = cleanText.length

  // Calculate page count
  const estimatedPages = totalChars / charsPerPage

  return Math.max(estimatedPages, 0)
}

/**
 * Convert pages to characters based on page settings
 */
export function convertPagesToCharacters(pages: number, settings: PageCountSettings): number {
  const charsPerPage = calculateCharactersPerPage(settings)
  return Math.round(pages * charsPerPage)
}

/**
 * Format page settings into a readable string
 */
export function formatPageSettings(settings: PageCountSettings): string {
  const fontNames: Record<string, string> = {
    times: 'Times New Roman',
    arial: 'Arial',
    calibri: 'Calibri',
    helvetica: 'Helvetica'
  }
  
  const spacingNames: Record<string, string> = {
    single: 'Single',
    '1.5': '1.5x',
    double: 'Double'
  }
  
  const marginNames: Record<string, string> = {
    '0.5inch': '0.5"',
    '1inch': '1"',
    '1.5inch': '1.5"'
  }
  
  const paperNames: Record<string, string> = {
    letter: 'Letter',
    a4: 'A4',
    legal: 'Legal'
  }
  
  return `${settings.fontSize}pt ${fontNames[settings.fontFamily]}, ${paperNames[settings.paperSize]}, ${spacingNames[settings.lineSpacing]}-spaced, ${marginNames[settings.margins]} margins`
}
