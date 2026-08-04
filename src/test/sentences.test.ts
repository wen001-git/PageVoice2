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

  it('reconstructs OCR line wraps before splitting sentences', () => {
    expect(splitSentences(`In 2010, after six years of training
and a further six years on the wards,
I resigned from my job as a junior
doctor.
My parents still haven't forgiven
me.`)).toEqual([
      'In 2010, after six years of training and a further six years on the wards, I resigned from my job as a junior doctor.',
      "My parents still haven't forgiven me.",
    ])
  })

  it('repairs words hyphenated across OCR lines', () => {
    expect(splitSentences('The informa-\ntion was useful.')).toEqual(['The information was useful.'])
  })

  it('keeps a short book heading separate from the following sentence', () => {
    expect(splitSentences('Introduction\nIn 2010, I began training.')).toEqual([
      'Introduction',
      'In 2010, I began training.',
    ])
  })
})

describe('tokenizeSentence', () => {
  it('keeps contractions as clickable words', () => {
    const words = tokenizeSentence("Alice can't wait.").filter((token) => token.isWord)
    expect(words.map((token) => token.value)).toEqual(['Alice', "can't", 'wait'])
  })
})
