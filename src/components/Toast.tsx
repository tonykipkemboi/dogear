import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

type ToastKind = 'default' | 'success' | 'error'
interface ToastState {
  message: string
  kind: ToastKind
  id: number
}

interface ToastContextValue {
  notify: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastContextValue>({ notify: () => undefined })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timer = useRef<number | null>(null)

  const notify = useCallback((message: string, kind: ToastKind = 'default') => {
    if (timer.current) window.clearTimeout(timer.current)
    setToast({ message, kind, id: Date.now() })
    timer.current = window.setTimeout(() => setToast(null), 3600)
  }, [])

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {toast ? (
          <div key={toast.id} className={`toast toast--${toast.kind}`} role="status">
            <span className="toast__dot" aria-hidden="true" />
            {toast.message}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext)
}
