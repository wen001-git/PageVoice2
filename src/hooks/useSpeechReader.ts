import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReadingRate } from '../types'

export type SpeechStatus = 'idle' | 'speaking' | 'paused'

type Options = {
  sentences: string[]
  currentIndex: number
  rate: ReadingRate
  voiceURI: string
  repeat: boolean
  onIndexChange: (index: number) => void
}

export function useSpeechReader({ sentences, currentIndex, rate, voiceURI, repeat, onIndexChange }: Options) {
  const [status, setStatus] = useState<SpeechStatus>('idle')
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const tokenRef = useRef(0)
  const optionsRef = useRef({ sentences, currentIndex, rate, voiceURI, repeat, onIndexChange })

  useEffect(() => {
    optionsRef.current = { sentences, currentIndex, rate, voiceURI, repeat, onIndexChange }
  }, [sentences, currentIndex, rate, voiceURI, repeat, onIndexChange])

  useEffect(() => {
    const refresh = () => {
      const english = window.speechSynthesis
        .getVoices()
        .filter((voice) => voice.lang.toLowerCase().startsWith('en'))
      setVoices(english)
    }
    refresh()
    window.speechSynthesis.addEventListener('voiceschanged', refresh)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', refresh)
  }, [])

  const stop = useCallback(() => {
    tokenRef.current += 1
    window.speechSynthesis.cancel()
    setStatus('idle')
  }, [])

  const speakAt = useCallback((target: number) => {
    const options = optionsRef.current
    if (!options.sentences[target]) {
      stop()
      return
    }
    tokenRef.current += 1
    const token = tokenRef.current
    window.speechSynthesis.cancel()
    options.onIndexChange(target)
    setStatus('speaking')

    const utterance = new SpeechSynthesisUtterance(options.sentences[target])
    utterance.lang = 'en-US'
    utterance.rate = options.rate
    const voice = window.speechSynthesis.getVoices().find((candidate) => candidate.voiceURI === options.voiceURI)
    if (voice) utterance.voice = voice
    utterance.onstart = () => token === tokenRef.current && setStatus('speaking')
    utterance.onpause = () => token === tokenRef.current && setStatus('paused')
    utterance.onresume = () => token === tokenRef.current && setStatus('speaking')
    utterance.onerror = (event) => {
      if (token === tokenRef.current && event.error !== 'canceled' && event.error !== 'interrupted') setStatus('idle')
    }
    utterance.onend = () => {
      if (token !== tokenRef.current) return
      const latest = optionsRef.current
      if (latest.repeat) {
        speakAt(target)
      } else if (target < latest.sentences.length - 1) {
        speakAt(target + 1)
      } else {
        setStatus('idle')
      }
    }
    window.speechSynthesis.speak(utterance)
  }, [stop])

  const toggle = useCallback(() => {
    if (!sentences.length) return
    if (status === 'speaking') {
      window.speechSynthesis.pause()
      setStatus('paused')
    } else if (status === 'paused' && window.speechSynthesis.paused) {
      window.speechSynthesis.resume()
      setStatus('speaking')
    } else {
      speakAt(currentIndex)
    }
  }, [currentIndex, sentences.length, speakAt, status])

  const restartCurrent = useCallback(() => speakAt(currentIndex), [currentIndex, speakAt])
  const previous = useCallback(() => speakAt(Math.max(0, currentIndex - 1)), [currentIndex, speakAt])
  const next = useCallback(
    () => speakAt(Math.min(sentences.length - 1, currentIndex + 1)),
    [currentIndex, sentences.length, speakAt],
  )

  const speakWord = useCallback((word: string) => {
    tokenRef.current += 1
    window.speechSynthesis.cancel()
    setStatus('paused')
    const utterance = new SpeechSynthesisUtterance(word)
    utterance.lang = 'en-US'
    utterance.rate = 0.9
    const selected = window.speechSynthesis.getVoices().find((voice) => voice.voiceURI === optionsRef.current.voiceURI)
    if (selected) utterance.voice = selected
    window.speechSynthesis.speak(utterance)
  }, [])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause()
        setStatus('paused')
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => stop, [stop])

  return { status, voices, speakAt, toggle, stop, previous, next, restartCurrent, speakWord }
}
