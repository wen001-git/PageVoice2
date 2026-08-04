const CLOUD_OCR_PIN_KEY = 'pagevoice-cloud-ocr-pin-v1'
const CLOUD_OCR_TIMEOUT_MS = 45_000

type CloudOcrResponse = {
  text?: string
  lines?: string[]
  requestId?: string
  code?: string
  message?: string
}

export class CloudOcrError extends Error {
  code: string
  status: number

  constructor(message: string, code = 'OCR_FAILURE', status = 0) {
    super(message)
    this.name = 'CloudOcrError'
    this.code = code
    this.status = status
  }
}

export function getCloudOcrPin(): string {
  try { return window.localStorage.getItem(CLOUD_OCR_PIN_KEY) ?? '' } catch { return '' }
}

export function saveCloudOcrPin(pin: string): void {
  try { window.localStorage.setItem(CLOUD_OCR_PIN_KEY, pin) } catch { /* OCR still works when storage is blocked. */ }
}

export function clearCloudOcrPin(): void {
  try { window.localStorage.removeItem(CLOUD_OCR_PIN_KEY) } catch { /* Storage may be blocked. */ }
}

export async function recognizeWithTencent(imageBase64: string, pin: string, signal?: AbortSignal): Promise<CloudOcrResponse> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  const timeout = window.setTimeout(() => controller.abort(), CLOUD_OCR_TIMEOUT_MS)

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}api/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, pin }),
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
    })
    const result = await response.json().catch(() => ({})) as CloudOcrResponse
    if (!response.ok) throw new CloudOcrError(result.message || '高精度识别失败，请改用本地识别。', result.code, response.status)
    return result
  } catch (error) {
    if (error instanceof CloudOcrError) throw error
    if (controller.signal.aborted) throw new DOMException('OCR cancelled', 'AbortError')
    throw new CloudOcrError('无法连接高精度识别服务，请检查网络或改用本地识别。', 'NETWORK_ERROR')
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}
