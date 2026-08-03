import { describe, expect, it } from 'vitest'
import { splitSentences, tokenizeSentence } from '../lib/sentences'

describe('splitSentences', () => {
  it('splits common English punctuation and keeps quotes', () => {
    expect(splitSentences('“Hello there!” she said. Are you ready? Yes.')).toEqual([
      '“Hello there!”',
      'she said.',
      'Are you ready?',
      'Yes.',
    ])
  })

  it('returns no sentence for whitespace', () => {
    expect(splitSentences('  \n ')).toEqual([])
  })
})

describe('tokenizeSentence', () => {
  it('keeps contractions as clickable words', () => {
    const words = tokenizeSentence("Alice can't wait.").filter((token) => token.isWord)
    expect(words.map((token) => token.value)).toEqual(['Alice', "can't", 'wait'])
  })
})
