export function isStandaloneHeading(line: string): boolean {
  const words = line.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) ?? []
  if (!words.length || words.length > 8 || line.length > 60 || /[.!?][”’"']?$/.test(line)) return false
  if (words.length === 1) return /^[A-Z][A-Za-z'’-]*$/.test(words[0])
  return words.every((word) => /^[A-Z0-9]/.test(word) || /^(a|an|and|as|at|by|for|in|of|on|or|the|to)$/i.test(word))
}

export function normalizeReadingText(text: string): string {
  const paragraphs = text
    .replace(/\r\n?/g, '\n')
    .replace(/([A-Za-z]{2,})-[ \t]*\n[ \t]*([a-z]{2,})/g, '$1$2')
    .split(/\n[ \t]*\n+/)
    .flatMap((paragraph) => {
      const result: string[] = []
      let wrappedLines: string[] = []
      const flushWrappedLines = () => {
        if (wrappedLines.length) result.push(wrappedLines.join(' '))
        wrappedLines = []
      }

      paragraph.split('\n').map((line) => line.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).forEach((line) => {
        if (isStandaloneHeading(line)) {
          flushWrappedLines()
          result.push(line)
        } else {
          wrappedLines.push(line)
        }
      })
      flushWrappedLines()
      return result
    })
    .map((paragraph) => paragraph.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
  return paragraphs.join('\n\n').trim()
}

export function splitSentences(text: string): string[] {
  const normalized = normalizeReadingText(text)
  if (!normalized) return []

  return normalized.split(/\n{2,}/).flatMap((paragraph) => {
    if ('Segmenter' in Intl) {
      const Segmenter = Intl.Segmenter
      return [...new Segmenter('en', { granularity: 'sentence' }).segment(paragraph)]
        .map((part) => part.segment.trim())
        .filter(Boolean)
    }

    return (paragraph.match(/[^.!?]+(?:[.!?]+[”’"']?|$)/g) ?? [paragraph])
      .map((sentence) => sentence.trim())
      .filter(Boolean)
  })
}

export function tokenizeSentence(sentence: string): Array<{ value: string; isWord: boolean }> {
  return sentence
    .split(/([A-Za-z]+(?:['’-][A-Za-z]+)*)/g)
    .filter(Boolean)
    .map((value) => ({ value, isWord: /^[A-Za-z]/.test(value) }))
}
