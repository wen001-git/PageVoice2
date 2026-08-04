import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSpeechReader } from '../hooks/useSpeechReader'

class FakeUtterance {
  text: string
  lang = ''
  rate = 1
  voice: SpeechSynthesisVoice | null = null
  onstart: (() => void) | null = null
  onpause: (() => void) | null = null
  onresume: (() => void) | null = null
  onerror: ((event: { error: string }) => void) | null = null
  onend: (() => void) | null = null

  constructor(text: string) { this.text = text }
}

let spoken: FakeUtterance[]
let paused = false
let autoStart = true

beforeEach(() => {
  spoken = []
  paused = false
  autoStart = true
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FakeUtterance, configurable: true })
  Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', { value: FakeUtterance, configurable: true })
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      get paused() { return paused },
      get speaking() { return spoken.length > 0 && !paused },
      getVoices: () => [],
      speak: (utterance: FakeUtterance) => { spoken.push(utterance); if (autoStart) utterance.onstart?.() },
      cancel: () => { spoken = [] },
      pause: () => { paused = true },
      resume: () => { paused = false },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  })
})

describe('useSpeechReader', () => {
  it('advances one utterance per sentence', () => {
    const onIndexChange = vi.fn()
    const { result } = renderHook(() => useSpeechReader({
      sentences: ['First sentence.', 'Second sentence.'],
      currentIndex: 0,
      rate: 1,
      voiceURI: '',
      repeat: false,
      onIndexChange,
    }))

    act(() => result.current.speakAt(0))
    expect(spoken[0].text).toBe('First sentence.')
    expect(result.current.status).toBe('speaking')

    act(() => spoken[0].onend?.())
    expect(onIndexChange).toHaveBeenLastCalledWith(1)
    expect(spoken[0].text).toBe('Second sentence.')
  })

  it('repeats the current sentence when repeat is enabled', () => {
    const { result } = renderHook(() => useSpeechReader({
      sentences: ['Repeat me.'],
      currentIndex: 0,
      rate: 0.75,
      voiceURI: '',
      repeat: true,
      onIndexChange: vi.fn(),
    }))

    act(() => result.current.speakAt(0))
    const first = spoken[0]
    act(() => first.onend?.())
    expect(spoken[0].text).toBe('Repeat me.')
    expect(spoken[0].rate).toBe(0.75)
  })

  it('shows a starting state until the speech engine actually starts', () => {
    autoStart = false
    const { result } = renderHook(() => useSpeechReader({
      sentences: ['Start after the engine is ready.'],
      currentIndex: 0,
      rate: 1,
      voiceURI: '',
      repeat: false,
      onIndexChange: vi.fn(),
    }))

    act(() => result.current.speakAt(0))
    expect(result.current.status).toBe('starting')
    act(() => spoken[0].onstart?.())
    expect(result.current.status).toBe('speaking')
  })

  it('reports a helpful error when Android speech does not start', () => {
    vi.useFakeTimers()
    autoStart = false
    const { result } = renderHook(() => useSpeechReader({
      sentences: ['This should time out.'],
      currentIndex: 0,
      rate: 1,
      voiceURI: '',
      repeat: false,
      onIndexChange: vi.fn(),
    }))

    act(() => result.current.speakAt(0))
    act(() => vi.advanceTimersByTime(2_500))
    expect(result.current.status).toBe('idle')
    expect(result.current.error).toContain('Android')
    vi.useRealTimers()
  })
})
