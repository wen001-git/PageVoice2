import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReadingRate } from '../types'

export type SpeechStatus = 'idle' | 'starting' | 'speaking' | 'paused'
type PlaybackMode = 'continuous' | 'single' | 'repeat'

const SPEECH_START_TIMEOUT_MS = 2_500

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
  const [error, setError] = useState('')
  const tokenRef = useRef(0)
  const startTimerRef = useRef<number | null>(null)
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

  const clearStartTimer = useCallback(() => {
    if (startTimerRef.current === null) return
    window.clearTimeout(startTimerRef.current)
    startTimerRef.current = null
  }, [])

  const speechErrorMessage = useCallback((code?: string) => {
    if (code === 'language-unavailable' || code === 'voice-unavailable') {
      return '手机没有可用的英文声音。请在 Android“文字转语音输出”中安装英文语音数据。'
    }
    if (code === 'network' || code === 'synthesis-unavailable' || code === 'synthesis-failed') {
      return '手机语音引擎暂时不可用。请检查网络和 Android 文字转语音设置后重试。'
    }
    if (code === 'not-allowed') return '浏览器阻止了朗读。请再次点击播放，并确认页面声音权限已开启。'
    return '没有听到声音？请调高媒体音量，并在 Android“文字转语音输出”中安装英文语音数据。'
  }, [])

  const armStartTimeout = useCallback((token: number, started: () => boolean) => {
    clearStartTimer()
    startTimerRef.current = window.setTimeout(() => {
      startTimerRef.current = null
      if (token !== tokenRef.current || started()) return
      tokenRef.current += 1
      window.speechSynthesis.cancel()
      setStatus('idle')
      setError(speechErrorMessage())
    }, SPEECH_START_TIMEOUT_MS)
  }, [clearStartTimer, speechErrorMessage])

  const stop = useCallback(() => {
    tokenRef.current += 1
    clearStartTimer()
    window.speechSynthesis.cancel()
    setStatus('idle')
  }, [clearStartTimer])

  const speakAt = useCallback((target: number, mode: PlaybackMode = 'continuous') => {
    const options = optionsRef.current
    if (!options.sentences[target]) {
      stop()
      return
    }
    tokenRef.current += 1
    const token = tokenRef.current
    window.speechSynthesis.cancel()
    options.onIndexChange(target)
    setError('')
    setStatus('starting')

    const utterance = new SpeechSynthesisUtterance(options.sentences[target])
    utterance.lang = 'en-US'
    utterance.rate = options.rate
    const availableVoices = window.speechSynthesis.getVoices()
    const englishVoices = availableVoices.filter((candidate) => candidate.lang.toLowerCase().startsWith('en'))
    const voice = availableVoices.find((candidate) => candidate.voiceURI === options.voiceURI)
      ?? englishVoices.find((candidate) => candidate.default)
      ?? englishVoices.find((candidate) => candidate.lang.toLowerCase() === 'en-us')
      ?? englishVoices[0]
    if (voice) utterance.voice = voice
    let started = false
    utterance.onstart = () => {
      if (token !== tokenRef.current) return
      started = true
      clearStartTimer()
      setStatus('speaking')
    }
    utterance.onpause = () => token === tokenRef.current && setStatus('paused')
    utterance.onresume = () => token === tokenRef.current && setStatus('speaking')
    utterance.onerror = (event) => {
      if (token !== tokenRef.current || event.error === 'canceled' || event.error === 'interrupted') return
      clearStartTimer()
      setStatus('idle')
      setError(speechErrorMessage(event.error))
    }
    utterance.onend = () => {
      if (token !== tokenRef.current) return
      clearStartTimer()
      const latest = optionsRef.current
      if (latest.repeat) {
        speakAt(target, 'repeat')
      } else if (mode === 'continuous' && target < latest.sentences.length - 1) {
        speakAt(target + 1, 'continuous')
      } else {
        setStatus('idle')
      }
    }
    armStartTimeout(token, () => started)
    window.speechSynthesis.speak(utterance)
  }, [armStartTimeout, clearStartTimer, speechErrorMessage, stop])

  const toggle = useCallback(() => {
    if (!sentences.length) return
    if (status === 'starting') {
      stop()
    } else if (status === 'speaking') {
      window.speechSynthesis.pause()
      setStatus('paused')
    } else if (status === 'paused' && window.speechSynthesis.paused) {
      window.speechSynthesis.resume()
      setStatus('speaking')
    } else {
      speakAt(currentIndex, 'continuous')
    }
  }, [currentIndex, sentences.length, speakAt, status])

  const speakSentence = useCallback((target: number) => speakAt(target, 'single'), [speakAt])
  const restartCurrent = useCallback(() => speakSentence(currentIndex), [currentIndex, speakSentence])
  const previous = useCallback(() => speakSentence(Math.max(0, currentIndex - 1)), [currentIndex, speakSentence])
  const next = useCallback(
    () => speakSentence(Math.min(sentences.length - 1, currentIndex + 1)),
    [currentIndex, sentences.length, speakSentence],
  )

  const speakWord = useCallback((word: string) => {
    tokenRef.current += 1
    const token = tokenRef.current
    clearStartTimer()
    window.speechSynthesis.cancel()
    setError('')
    setStatus('starting')
    const utterance = new SpeechSynthesisUtterance(word)
    utterance.lang = 'en-US'
    utterance.rate = 0.9
    const availableVoices = window.speechSynthesis.getVoices()
    const englishVoices = availableVoices.filter((voice) => voice.lang.toLowerCase().startsWith('en'))
    const selected = availableVoices.find((voice) => voice.voiceURI === optionsRef.current.voiceURI)
      ?? englishVoices.find((voice) => voice.default)
      ?? englishVoices[0]
    if (selected) utterance.voice = selected
    let started = false
    utterance.onstart = () => {
      if (token !== tokenRef.current) return
      started = true
      clearStartTimer()
      setStatus('speaking')
    }
    utterance.onend = () => {
      if (token !== tokenRef.current) return
      clearStartTimer()
      setStatus('paused')
    }
    utterance.onerror = (event) => {
      if (token !== tokenRef.current || event.error === 'canceled' || event.error === 'interrupted') return
      clearStartTimer()
      setStatus('paused')
      setError(speechErrorMessage(event.error))
    }
    armStartTimeout(token, () => started)
    window.speechSynthesis.speak(utterance)
  }, [armStartTimeout, clearStartTimer, speechErrorMessage])

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

  return { status, voices, error, clearError: () => setError(''), speakAt, speakSentence, toggle, stop, previous, next, restartCurrent, speakWord }
}
