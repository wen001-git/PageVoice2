import { createWorker, OEM, type Worker } from 'tesseract.js'

let activeWorker: Worker | null = null

export type OcrProgress = { status: string; progress: number }

export async function recognizeEnglish(
  image: string,
  onProgress: (progress: OcrProgress) => void,
): Promise<string> {
  const base = import.meta.env.BASE_URL
  const worker = await createWorker('eng', OEM.LSTM_ONLY, {
    langPath: `${base}tessdata`,
    corePath: `${base}tesseract-core`,
    logger: (message) => onProgress({ status: message.status, progress: message.progress }),
  })
  activeWorker = worker
  try {
    await worker.setParameters({ preserve_interword_spaces: '1' })
    const result = await worker.recognize(image)
    return result.data.text.trim()
  } finally {
    if (activeWorker === worker) activeWorker = null
    try { await worker.terminate() } catch { /* Worker may already be terminated by cancelRecognition. */ }
  }
}

export async function cancelRecognition(): Promise<void> {
  if (!activeWorker) return
  const worker = activeWorker
  activeWorker = null
  await worker.terminate()
}
