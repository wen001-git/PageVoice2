export type PreparedImage = {
  dataUrl: string
  thumbnail: Blob
  width: number
  height: number
}

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
