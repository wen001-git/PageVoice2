import type { DictionaryEntry } from '../types'

type RawEntry = { p: string; t: string[] }
type DictionaryShard = Record<string, RawEntry>
type DictionaryIndex = { version: number; count: number; files: string[] }

const shardCache = new Map<string, DictionaryShard>()
let lemmaCache: Record<string, string> | null = null

function normalize(word: string): string {
  return word.toLowerCase().replace(/^[^a-z]+|[^a-z'-]+$/g, '')
}

function prefixFor(word: string): string {
  return word.slice(0, 2).padEnd(2, '_')
}

async function loadShard(word: string): Promise<DictionaryShard> {
  const prefix = prefixFor(word)
  if (shardCache.has(prefix)) return shardCache.get(prefix)!
  const response = await fetch(`${import.meta.env.BASE_URL}dictionary/${prefix}.json`)
  if (!response.ok) return {}
  const shard = (await response.json()) as DictionaryShard
  shardCache.set(prefix, shard)
  return shard
}

async function loadLemmas(): Promise<Record<string, string>> {
  if (lemmaCache) return lemmaCache
  const response = await fetch(`${import.meta.env.BASE_URL}dictionary/lemmas.json`)
  if (!response.ok) return {}
  lemmaCache = (await response.json()) as Record<string, string>
  return lemmaCache
}

async function findRaw(word: string): Promise<RawEntry | undefined> {
  return (await loadShard(word))[word]
}

export async function lookupWord(input: string): Promise<DictionaryEntry | null> {
  const word = normalize(input)
  if (!word) return null
  let lemma = word
  let raw = await findRaw(word)
  if (!raw) {
    const lemmas = await loadLemmas()
    lemma = lemmas[word] || word
    raw = await findRaw(lemma)
  }
  if (!raw) return null
  return { word, lemma: lemma === word ? undefined : lemma, phonetic: raw.p, translations: raw.t }
}

export async function prepareOfflineResources(onProgress: (done: number, total: number) => void): Promise<void> {
  const base = import.meta.env.BASE_URL
  const indexResponse = await fetch(`${base}dictionary/index.json`, { cache: 'no-store' })
  if (!indexResponse.ok) throw new Error('无法取得离线词典清单。')
  const index = (await indexResponse.json()) as DictionaryIndex
  const dictionaryUrls = ['index.json', ...index.files].map((file) => `${base}dictionary/${file}`)
  const coreFiles = [
    'tesseract-core.wasm.js',
    'tesseract-core-simd.wasm.js',
    'tesseract-core-lstm.wasm.js',
    'tesseract-core-simd-lstm.wasm.js',
  ].map((file) => `${base}tesseract-core/${file}`)
  const ocrUrls = [`${base}tessdata/eng.traineddata.gz`, ...coreFiles]
  const total = dictionaryUrls.length + ocrUrls.length
  let done = 0

  async function cacheUrls(name: string, urls: string[]) {
    const cache = await caches.open(name)
    const queue = [...urls]
    const runners = Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const url = queue.shift()!
        const request = new Request(url)
        if (!(await cache.match(request))) {
          const response = await fetch(request, { cache: 'no-store' })
          if (!response.ok) throw new Error(`离线资源下载失败：${url}`)
          await cache.put(request, response)
        }
        done += 1
        onProgress(done, total)
      }
    })
    await Promise.all(runners)
  }

  await cacheUrls('pagevoice-ocr-v1', ocrUrls)
  await cacheUrls('pagevoice-dictionary-v1', dictionaryUrls)
}
