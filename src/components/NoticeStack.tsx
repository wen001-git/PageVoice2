import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

export type NoticeTone = 'success' | 'info' | 'warning' | 'error'

export type NoticeMessage = {
  id: number
  message: string
  tone: NoticeTone
}

const AUTO_DISMISS_MS = 3_000
const EXIT_ANIMATION_MS = 180

export function NoticeStack({ notice, needRefresh, onDismiss, onUpdate }: {
  notice: NoticeMessage | null
  needRefresh: boolean
  onDismiss: () => void
  onUpdate: () => void
}) {
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    setClosing(false)
    if (!notice || (notice.tone !== 'success' && notice.tone !== 'info')) return

    const exitTimer = window.setTimeout(() => setClosing(true), AUTO_DISMISS_MS - EXIT_ANIMATION_MS)
    const dismissTimer = window.setTimeout(onDismiss, AUTO_DISMISS_MS)
    return () => {
      window.clearTimeout(exitTimer)
      window.clearTimeout(dismissTimer)
    }
  }, [notice, onDismiss])

  if (!notice && !needRefresh) return null

  return (
    <div className="notice-stack" aria-live="polite">
      {notice && (
        <div
          key={notice.id}
          className={`notice notice--${notice.tone}${closing ? ' is-closing' : ''}`}
          role={notice.tone === 'error' ? 'alert' : 'status'}
        >
          <span>{notice.message}</span>
          <button onClick={onDismiss} aria-label="关闭提示"><X size={16} /></button>
        </div>
      )}
      {needRefresh && (
        <div className="notice notice--update" role="status">
          <span>发现新版本。</span>
          <button onClick={onUpdate}>刷新更新</button>
        </div>
      )}
    </div>
  )
}
