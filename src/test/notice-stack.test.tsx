import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NoticeStack, type NoticeMessage } from '../components/NoticeStack'

function message(id: number, tone: NoticeMessage['tone'], text = '测试提示'): NoticeMessage {
  return { id, tone, message: text }
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('NoticeStack', () => {
  it('fades and dismisses success messages after three seconds', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    const { container } = render(<NoticeStack notice={message(1, 'success')} needRefresh={false} onDismiss={onDismiss} onUpdate={vi.fn()} />)

    act(() => vi.advanceTimersByTime(2_820))
    expect(container.querySelector('.notice')).toHaveClass('is-closing')
    expect(onDismiss).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(180))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('restarts the timer when a newer message replaces the current one', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    const { rerender } = render(<NoticeStack notice={message(1, 'info', '第一条')} needRefresh={false} onDismiss={onDismiss} onUpdate={vi.fn()} />)

    act(() => vi.advanceTimersByTime(2_000))
    rerender(<NoticeStack notice={message(2, 'success', '第二条')} needRefresh={false} onDismiss={onDismiss} onUpdate={vi.fn()} />)
    act(() => vi.advanceTimersByTime(2_999))
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('keeps errors visible and allows immediate manual dismissal', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(<NoticeStack notice={message(1, 'error', '下载失败')} needRefresh={false} onDismiss={onDismiss} onUpdate={vi.fn()} />)

    act(() => vi.advanceTimersByTime(10_000))
    expect(onDismiss).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('下载失败')

    fireEvent.click(screen.getByRole('button', { name: '关闭提示' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('keeps the update action visible without overlapping the current message', () => {
    vi.useFakeTimers()
    const onUpdate = vi.fn()
    const { container } = render(<NoticeStack notice={message(1, 'success')} needRefresh onDismiss={vi.fn()} onUpdate={onUpdate} />)

    expect(container.querySelectorAll('.notice')).toHaveLength(2)
    act(() => vi.advanceTimersByTime(10_000))
    expect(screen.getByRole('button', { name: '刷新更新' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '刷新更新' }))
    expect(onUpdate).toHaveBeenCalledTimes(1)
  })
})
