export function splitSentences(text: string): string[] {
  const normalized = text.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').trim()
  if (!normalized) return []

  if ('Segmenter' in Intl) {
    const Segmenter = Intl.Segmenter
    return [...new Segmenter('en', { granularity: 'sentence' }).segment(normalized)]
      .map((part) => part.segment.trim())
      .filter(Boolean)
  }

  return (normalized.match(/[^.!?\n]+(?:[.!?]+[”’"']?|$)/g) ?? [normalized])
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

export function tokenizeSentence(sentence: string): Array<{ value: string; isWord: boolean }> {
  return sentence
    .split(/([A-Za-z]+(?:['’-][A-Za-z]+)*)/g)
    .filter(Boolean)
    .map((value) => ({ value, isWord: /^[A-Za-z]/.test(value) }))
}
