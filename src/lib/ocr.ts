import { createWorker, OEM, type Worker } from 'tesseract.js'

const INITIALIZATION_TIMEOUT_MS = 120_000

let cachedWorker: Worker | null = null
let workerPromise: Promise<Worker> | null = null
let workerGeneration = 0
let progressListener: ((progress: OcrProgress) => void) | null = null

export type OcrProgress = { status: string; progress: number }

function report(status: string, progress: number) {
  progressListener?.({ status, progress })
}

async function createEnglishWorker(generation: number): Promise<Worker> {
  const base = import.meta.env.BASE_URL
  const worker = await createWorker('eng', OEM.LSTM_ONLY, {
    langPath: `${base}tessdata`,
    corePath: `${base}tesseract-core`,
    logger: (message) => {
      if (generation === workerGeneration) report(message.status, message.progress)
    },
  })

  if (generation !== workerGeneration) {
    await worker.terminate()
    throw new DOMException('OCR cancelled', 'AbortError')
  }

  await worker.setParameters({ preserve_interword_spaces: '1' })
  cachedWorker = worker
  return worker
}

function getEnglishWorker(): Promise<Worker> {
  if (cachedWorker) {
    report('reusing initialized worker', 1)
    return Promise.resolve(cachedWorker)
  }
  if (workerPromise) return workerPromise

  const generation = workerGeneration
  const pending = createEnglishWorker(generation)
  workerPromise = pending
  void pending.finally(() => {
    if (workerPromise === pending) workerPromise = null
  }).catch(() => undefined)
  return pending
}

async function waitForWorker(): Promise<Worker> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      workerGeneration += 1
      workerPromise = null
      reject(new Error('英文 OCR 模型下载或初始化超时。请检查网络，或先到“设置”准备离线资源后重试。'))
    }, INITIALIZATION_TIMEOUT_MS)
  })

  try {
    return await Promise.race([getEnglishWorker(), timeout])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export async function recognizeEnglish(
  image: string,
  onProgress: (progress: OcrProgress) => void,
): Promise<string> {
  const generation = workerGeneration
  progressListener = onProgress

  let worker: Worker
  try {
    worker = await waitForWorker()
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    if (error instanceof Error && error.message.includes('超时')) throw error
    const detail = error instanceof Error ? `（${error.message}）` : ''
    throw new Error(`英文 OCR 引擎加载失败，请检查网络后重试${detail}`)
  }

  if (generation !== workerGeneration) throw new DOMException('OCR cancelled', 'AbortError')

  try {
    report('recognizing text', 0)
    const result = await worker.recognize(image)
    if (generation !== workerGeneration) throw new DOMException('OCR cancelled', 'AbortError')
    return result.data.text.trim()
  } catch (error) {
    if (generation === workerGeneration) {
      cachedWorker = null
      workerGeneration += 1
      try { await worker.terminate() } catch { /* The failed worker may already be terminated. */ }
    }
    throw error
  } finally {
    progressListener = null
  }
}

export async function cancelRecognition(): Promise<void> {
  workerGeneration += 1
  progressListener = null
  workerPromise = null
  const worker = cachedWorker
  cachedWorker = null
  if (worker) {
    try { await worker.terminate() } catch { /* Cancellation may race with worker shutdown. */ }
  }
}
