import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface DialogProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
  labelledBy?: string
  sheet?: boolean
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Dialog({ open, onClose, children, className = '', labelledBy, sheet = false }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return undefined
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current
      if (!panel) return
      const first = panel.querySelector<HTMLElement>(FOCUSABLE)
      ;(first ?? panel).focus()
    }, 20)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (item) => item.offsetParent !== null,
      )
      if (items.length === 0) {
        event.preventDefault()
        panel.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previous?.focus()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className={`dialog-layer ${sheet ? 'dialog-layer--sheet' : ''}`}>
      <div className="dialog-scrim" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className={`dialog-panel ${sheet ? 'dialog-panel--sheet' : ''} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
