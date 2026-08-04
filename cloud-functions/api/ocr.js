import { timingSafeEqual } from 'node:crypto'
import tencentcloud from 'tencentcloud-sdk-nodejs-ocr'

const MAX_REQUEST_BYTES = 5 * 1024 * 1024
const MAX_BASE64_LENGTH = 4_500_000
const OcrClient = tencentcloud.ocr.v20181119.Client

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

function sameSecret(left, right) {
  const leftBuffer = Buffer.from(String(left ?? ''))
  const rightBuffer = Buffer.from(String(right ?? ''))
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

function isBase64Image(value) {
  return typeof value === 'string'
    && value.length >= 100
    && value.length <= MAX_BASE64_LENGTH
    && value.length % 4 === 0
    && /^[A-Za-z0-9+/]+={0,2}$/.test(value)
}

function publicError(error) {
  const code = typeof error?.code === 'string' ? error.code : ''
  if (/NoEnoughPackage|ResourcePackageRunOut|InArrears|ResourcesSoldOut|Insufficient/i.test(code)) {
    return { status: 429, code: 'QUOTA_EXHAUSTED', message: '腾讯云 OCR 免费额度或资源包已用完，请稍后再试或改用本地识别。' }
  }
  if (/AuthFailure|UnauthorizedOperation|InvalidCredential/i.test(code)) {
    return { status: 502, code: 'OCR_CONFIGURATION_ERROR', message: '高精度识别服务配置异常，请联系应用维护者。' }
  }
  if (/RequestLimitExceeded|LimitExceeded/i.test(code)) {
    return { status: 429, code: 'RATE_LIMITED', message: '高精度识别请求过于频繁，请稍后重试。' }
  }
  if (/InternalError|FailedOperation|Timeout|Network/i.test(code) || error?.name === 'AbortError') {
    return { status: 502, code: 'OCR_TEMPORARY_FAILURE', message: '腾讯云 OCR 暂时不可用，请稍后重试或改用本地识别。' }
  }
  return { status: 502, code: 'OCR_FAILURE', message: '高精度识别失败，请稍后重试或改用本地识别。' }
}

function createClient(env) {
  return new OcrClient({
    credential: {
      secretId: env.TENCENT_OCR_SECRET_ID,
      secretKey: env.TENCENT_OCR_SECRET_KEY,
    },
    region: env.TENCENT_OCR_REGION || 'ap-guangzhou',
    profile: { httpProfile: { endpoint: 'ocr.tencentcloudapi.com', reqTimeout: 25 } },
  })
}

export function createOcrHandler(clientFactory = createClient) {
  return async function handle(context) {
    const { request, env = {} } = context
    if (request.method !== 'POST') return json({ code: 'METHOD_NOT_ALLOWED', message: '只支持 POST 请求。' }, 405)

    const requestOrigin = request.headers.get('Origin')
    if (!requestOrigin || requestOrigin !== new URL(request.url).origin) {
      return json({ code: 'FORBIDDEN_ORIGIN', message: '只允许从 PageVoice2 页面调用。' }, 403)
    }

    const contentLength = Number(request.headers.get('Content-Length') || 0)
    if (contentLength > MAX_REQUEST_BYTES) return json({ code: 'IMAGE_TOO_LARGE', message: '图片过大，请重新拍摄或降低分辨率。' }, 413)

    const secretId = env.TENCENT_OCR_SECRET_ID
    const secretKey = env.TENCENT_OCR_SECRET_KEY
    const expectedPin = env.PAGEVOICE_OCR_PIN
    if (!secretId || !secretKey || !/^[A-Za-z0-9]{6,64}$/.test(expectedPin ?? '')) {
      return json({ code: 'OCR_NOT_CONFIGURED', message: '高精度识别服务尚未配置完成。' }, 503)
    }

    let payload
    try {
      payload = await request.json()
    } catch {
      return json({ code: 'INVALID_REQUEST', message: '请求格式不正确。' }, 400)
    }

    if (!sameSecret(payload?.pin, expectedPin)) return json({ code: 'INVALID_PIN', message: '家庭 PIN 不正确，请重新输入。' }, 401)
    if (!isBase64Image(payload?.imageBase64)) {
      const tooLarge = typeof payload?.imageBase64 === 'string' && payload.imageBase64.length > MAX_BASE64_LENGTH
      return json({ code: tooLarge ? 'IMAGE_TOO_LARGE' : 'INVALID_IMAGE', message: tooLarge ? '图片过大，请重新拍摄或降低分辨率。' : '图片数据无效，请换一张重试。' }, tooLarge ? 413 : 400)
    }

    try {
      const result = await clientFactory(env).GeneralAccurateOCR({
        ImageBase64: payload.imageBase64,
        ConfigID: 'OCR',
        WordsType: '2',
        EnableDetectText: true,
      })
      const lines = (result.TextDetections ?? [])
        .map((item) => String(item.DetectedText ?? '').trim())
        .filter(Boolean)
      return json({ text: lines.join('\n'), lines, requestId: result.RequestId ?? '' })
    } catch (error) {
      const mapped = publicError(error)
      return json({ code: mapped.code, message: mapped.message }, mapped.status)
    }
  }
}

export const onRequest = createOcrHandler()
export default onRequest
