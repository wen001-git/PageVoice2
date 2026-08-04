import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Capture } from '../App'
import type { ReadingProject } from '../types'

vi.mock('../lib/image', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/image')>()
  return {
    ...original,
    prepareImage: vi.fn().mockResolvedValue({
      dataUrl: 'data:image/jpeg;base64,AAAA',
      thumbnail: new Blob(['preview'], { type: 'image/jpeg' }),
      width: 1200,
      height: 1800,
    }),
  }
})

const project: ReadingProject = {
  id: 'capture-test',
  title: '测试书页',
  text: '',
  sentences: [],
  currentSentence: 0,
  rate: 1,
  voiceURI: '',
  repeatSentence: false,
  createdAt: 1,
  updatedAt: 1,
}

describe('Capture cloud OCR choices', () => {
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

  it('keeps cloud and local OCR distinct and asks for consent and PIN first', async () => {
    const { container } = render(<Capture project={project} onBack={vi.fn()} onPaste={vi.fn()} onRecognized={vi.fn()} />)
    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="file"]')
    expect(inputs).toHaveLength(2)
    fireEvent.change(inputs[1], { target: { files: [new File(['page'], 'page.jpg', { type: 'image/jpeg' })] } })

    await waitFor(() => expect(screen.getByRole('img', { name: '待识别书页' })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: '高精度识别（需联网）' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '本地离线识别' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '高精度识别（需联网）' }))
    expect(screen.getByRole('dialog', { name: '使用家庭高精度识别' })).toBeInTheDocument()
    expect(screen.getByLabelText('家庭 PIN')).toBeInTheDocument()
    expect(screen.getByText(/当前压缩书页将发送给腾讯云 OCR/)).toBeInTheDocument()
  })
})
