export type PreparedImage = {
  dataUrl: string
  thumbnail: Blob
  width: number
  height: number
}

const MAX_CLOUD_BASE64_LENGTH = 4_300_000

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('无法读取这张图片，请换一张重试。'))
    }
    image.src = url
  })

function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.78): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('图片处理失败。'))), 'image/jpeg', quality)
  })
}

const loadDataUrl = (dataUrl: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('无法准备高精度识别图片，请换一张重试。'))
    image.src = dataUrl
  })

export async function prepareCloudImage(dataUrl: string): Promise<string> {
  const image = await loadDataUrl(dataUrl)
  let width = image.naturalWidth
  let height = image.naturalHeight
  let quality = 0.86

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width))
    canvas.height = Math.max(1, Math.round(height))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('浏览器无法压缩高精度识别图片。')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const encoded = canvas.toDataURL('image/jpeg', quality).split(',', 2)[1] ?? ''
    if (encoded.length <= MAX_CLOUD_BASE64_LENGTH) return encoded

    if (quality > 0.58) quality -= 0.1
    else {
      const longSide = Math.max(width, height)
      if (longSide <= 1000) break
      const scale = Math.max(1000 / longSide, 0.82)
      width *= scale
      height *= scale
      quality = 0.72
    }
  }

  throw new Error('图片仍然过大，请靠近书页重新拍摄后再试。')
}

export async function prepareImage(file: File, rotation = 0, enhanced = false): Promise<PreparedImage> {
  const image = await loadImage(file)
  const maxSide = 2200
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
  const sourceWidth = Math.max(1, Math.round(image.naturalWidth * scale))
  const sourceHeight = Math.max(1, Math.round(image.naturalHeight * scale))
  const sideways = rotation % 180 !== 0
  const canvas = document.createElement('canvas')
  canvas.width = sideways ? sourceHeight : sourceWidth
  canvas.height = sideways ? sourceWidth : sourceHeight
  const context = canvas.getContext('2d', { willReadFrequently: enhanced })
  if (!context) throw new Error('浏览器无法处理图片。')

  context.save()
  context.translate(canvas.width / 2, canvas.height / 2)
  context.rotate((rotation * Math.PI) / 180)
  context.drawImage(image, -sourceWidth / 2, -sourceHeight / 2, sourceWidth, sourceHeight)
  context.restore()

  if (enhanced) {
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
    for (let index = 0; index < pixels.data.length; index += 4) {
      const gray = pixels.data[index] * 0.299 + pixels.data[index + 1] * 0.587 + pixels.data[index + 2] * 0.114
      const contrasted = Math.max(0, Math.min(255, (gray - 128) * 1.22 + 138))
      pixels.data[index] = contrasted
      pixels.data[index + 1] = contrasted
      pixels.data[index + 2] = contrasted
    }
    context.putImageData(pixels, 0, 0)
  }

  const thumbScale = Math.min(1, 320 / Math.max(canvas.width, canvas.height))
  const thumbnailCanvas = document.createElement('canvas')
  thumbnailCanvas.width = Math.max(1, Math.round(canvas.width * thumbScale))
  thumbnailCanvas.height = Math.max(1, Math.round(canvas.height * thumbScale))
  thumbnailCanvas.getContext('2d')?.drawImage(canvas, 0, 0, thumbnailCanvas.width, thumbnailCanvas.height)

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.9),
    thumbnail: await canvasToBlob(thumbnailCanvas, 0.72),
    width: canvas.width,
    height: canvas.height,
  }
}
