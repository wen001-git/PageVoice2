import { describe, expect, it, vi } from 'vitest'
import { createOcrHandler } from './ocr.js'

const validImage = 'A'.repeat(100)
const env = {
  TENCENT_OCR_SECRET_ID: 'test-id',
  TENCENT_OCR_SECRET_KEY: 'test-key',
  TENCENT_OCR_REGION: 'ap-guangzhou',
  PAGEVOICE_OCR_PIN: 'family123',
}

function context(body, options = {}) {
  const origin = options.origin === undefined ? 'https://pagevoice.test' : options.origin
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (origin) headers.set('Origin', origin)
  if (options.contentLength) headers.set('Content-Length', String(options.contentLength))
  return {
    request: new Request('https://pagevoice.test/api/ocr', {
      method: options.method ?? 'POST',
      headers,
      body: (options.method ?? 'POST') === 'GET' ? undefined : JSON.stringify(body),
    }),
    env: options.env ?? env,
  }
}

async function read(response) {
  return { status: response.status, body: await response.json() }
}

describe('Tencent OCR cloud handler', () => {
  it('returns ordered text without exposing credentials', async () => {
    const GeneralAccurateOCR = vi.fn().mockResolvedValue({
      RequestId: 'request-1',
      TextDetections: [{ DetectedText: 'First line' }, { DetectedText: 'Second line' }],
    })
    const handler = createOcrHandler(() => ({ GeneralAccurateOCR }))
    const result = await read(await handler(context({ imageBase64: validImage, pin: 'family123' })))

    expect(result).toEqual({ status: 200, body: { text: 'First line\nSecond line', lines: ['First line', 'Second line'], requestId: 'request-1' } })
    expect(GeneralAccurateOCR).toHaveBeenCalledWith(expect.objectContaining({ WordsType: '2', EnableDetectText: true }))
    expect(JSON.stringify(result)).not.toContain('test-key')
  })

  it('rejects an incorrect PIN before calling Tencent', async () => {
    const GeneralAccurateOCR = vi.fn()
    const result = await read(await createOcrHandler(() => ({ GeneralAccurateOCR }))(context({ imageBase64: validImage, pin: 'wrong' })))
    expect(result.status).toBe(401)
    expect(result.body.code).toBe('INVALID_PIN')
    expect(GeneralAccurateOCR).not.toHaveBeenCalled()
  })

  it('rejects missing configuration', async () => {
    const result = await read(await createOcrHandler()(context({ imageBase64: validImage, pin: 'family123' }, { env: {} })))
    expect(result.status).toBe(503)
    expect(result.body.code).toBe('OCR_NOT_CONFIGURED')
  })

  it('rejects cross-origin, invalid and oversized requests', async () => {
    const handler = createOcrHandler()
    expect((await read(await handler(context(null, { method: 'GET' })))).body.code).toBe('METHOD_NOT_ALLOWED')
    expect((await read(await handler(context({ imageBase64: validImage, pin: 'family123' }, { origin: 'https://other.test' })))).body.code).toBe('FORBIDDEN_ORIGIN')
    expect((await read(await handler(context({ imageBase64: 'not base64', pin: 'family123' })))).body.code).toBe('INVALID_IMAGE')
    expect((await read(await handler(context({ imageBase64: validImage, pin: 'family123' }, { contentLength: 6 * 1024 * 1024 })))).body.code).toBe('IMAGE_TOO_LARGE')
  })

  it('returns an empty successful result when no text is detected', async () => {
    const handler = createOcrHandler(() => ({ GeneralAccurateOCR: vi.fn().mockResolvedValue({ RequestId: 'empty', TextDetections: [] }) }))
    const result = await read(await handler(context({ imageBase64: validImage, pin: 'family123' })))
    expect(result).toEqual({ status: 200, body: { text: '', lines: [], requestId: 'empty' } })
  })

  it('maps quota and permission failures to safe public errors', async () => {
    const quotaHandler = createOcrHandler(() => ({ GeneralAccurateOCR: vi.fn().mockRejectedValue({ code: 'FailedOperation.NoEnoughPackage' }) }))
    const authHandler = createOcrHandler(() => ({ GeneralAccurateOCR: vi.fn().mockRejectedValue({ code: 'AuthFailure.SignatureFailure' }) }))
    expect((await read(await quotaHandler(context({ imageBase64: validImage, pin: 'family123' })))).body.code).toBe('QUOTA_EXHAUSTED')
    expect((await read(await authHandler(context({ imageBase64: validImage, pin: 'family123' })))).body.code).toBe('OCR_CONFIGURATION_ERROR')
  })

  it('maps Tencent timeouts to a retryable public error', async () => {
    const handler = createOcrHandler(() => ({ GeneralAccurateOCR: vi.fn().mockRejectedValue({ code: 'FailedOperation.EngineRecognizeTimeout' }) }))
    const result = await read(await handler(context({ imageBase64: validImage, pin: 'family123' })))
    expect(result).toEqual({ status: 502, body: { code: 'OCR_TEMPORARY_FAILURE', message: expect.any(String) } })
  })
})
