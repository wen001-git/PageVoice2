import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearCloudOcrPin, CloudOcrError, getCloudOcrPin, recognizeWithTencent, saveCloudOcrPin } from '../lib/cloudOcr'

afterEach(() => {
  clearCloudOcrPin()
  vi.restoreAllMocks()
})

describe('cloud OCR client', () => {
  it('stores and clears the family PIN on this device', () => {
    expect(getCloudOcrPin()).toBe('')
    saveCloudOcrPin('family123')
    expect(getCloudOcrPin()).toBe('family123')
    clearCloudOcrPin()
    expect(getCloudOcrPin()).toBe('')
  })

  it('posts the image and PIN to the same-origin API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ text: 'A page', lines: ['A page'], requestId: '1' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    const result = await recognizeWithTencent('AAAA', 'family123')
    expect(result.text).toBe('A page')
    expect(fetchMock).toHaveBeenCalledWith('/api/ocr', expect.objectContaining({ method: 'POST', credentials: 'same-origin', cache: 'no-store' }))
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ imageBase64: 'AAAA', pin: 'family123' })
  })

  it('surfaces the server error code without leaking response details', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ code: 'INVALID_PIN', message: '家庭 PIN 不正确，请重新输入。' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }))
    await expect(recognizeWithTencent('AAAA', 'wrong')).rejects.toMatchObject({ code: 'INVALID_PIN', status: 401 } satisfies Partial<CloudOcrError>)
  })

  it('turns a network failure into a readable OCR error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network down'))
    await expect(recognizeWithTencent('AAAA', 'family123')).rejects.toMatchObject({ code: 'NETWORK_ERROR' } satisfies Partial<CloudOcrError>)
  })

  it('cancels the active request without retrying', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true })
    }))
    const controller = new AbortController()
    const pending = recognizeWithTencent('AAAA', 'family123', controller.signal)
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })
})
beforeEach(() => {
  const values = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    },
  })
})
