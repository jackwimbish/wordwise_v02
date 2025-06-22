declare module 'text-readability' {
  interface TextReadability {
    fleschReadingEase(text: string): number
    fleschKincaidGrade(text: string): number
    gunningFog(text: string): number
    automatedReadabilityIndex(text: string): number
    colemanLiauIndex(text: string): number
    smogIndex(text: string): number
    daleChallReadabilityScore(text: string): number
    lexiconCount(text: string, removePunctuation?: boolean): number
    sentenceCount(text: string): number
    syllableCount(text: string, lang?: string): number
    textStandard(text: string, floatOutput?: boolean): string
    difficultWords(text: string): number
    linsearWriteFormula(text: string): number
  }

  const rs: TextReadability
  export default rs
} 