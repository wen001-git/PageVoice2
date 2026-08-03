export type ReadingRate = 0.75 | 1 | 1.2

export type ReadingProject = {
  id: string
  title: string
  text: string
  sentences: string[]
  currentSentence: number
  rate: ReadingRate
  voiceURI: string
  repeatSentence: boolean
  thumbnail?: Blob
  createdAt: number
  updatedAt: number
}

export type AppView = 'library' | 'capture' | 'edit' | 'reader' | 'settings'

export type DictionaryEntry = {
  word: string
  phonetic: string
  translations: string[]
  lemma?: string
}
