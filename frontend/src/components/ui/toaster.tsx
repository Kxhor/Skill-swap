import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { X } from "lucide-react"

export type ToastVariant = 'default' | 'danger' | 'success'

export interface ToastProps {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  variant?: ToastVariant
}

type ToastAction = 
  | { type: 'ADD_TOAST'; toast: ToastProps }
  | { type: 'REMOVE_TOAST'; toastId: string }

let memoryState: ToastProps[] = []
let listeners: Array<(state: ToastProps[]) => void> = []

function dispatch(action: ToastAction) {
  switch (action.type) {
    case 'ADD_TOAST':
      memoryState = [...memoryState, action.toast]
      break
    case 'REMOVE_TOAST':
      memoryState = memoryState.filter(t => t.id !== action.toastId)
      break
  }
  listeners.forEach(listener => listener(memoryState))
}

export function toast(props: Omit<ToastProps, 'id'>) {
  const id = Math.random().toString(36).substring(2, 9)
  dispatch({ type: 'ADD_TOAST', toast: { ...props, id } })
  setTimeout(() => {
    dispatch({ type: 'REMOVE_TOAST', toastId: id })
  }, 5000)
}

export function useToast() {
  const [toasts, setToasts] = React.useState<ToastProps[]>(memoryState)

  React.useEffect(() => {
    listeners.push(setToasts)
    return () => {
      listeners = listeners.filter(l => l !== setToasts)
    }
  }, [])

  return { toasts, toast }
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastPrimitives.Provider duration={5000}>
      {toasts.map(({ id, title, description, variant }) => {
        let variantClasses = "bg-surface border-border text-text"
        if (variant === 'danger') {
          variantClasses = "bg-danger text-white border-danger"
        } else if (variant === 'success') {
          variantClasses = "bg-success text-white border-success"
        }

        return (
          <ToastPrimitives.Root
            key={id}
            onOpenChange={(open) => {
              if (!open) dispatch({ type: 'REMOVE_TOAST', toastId: id })
            }}
            className={`group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-xl border p-4 shadow-lg transition-all data-[state=open]:animate-fade-in ${variantClasses}`}
          >
            <div className="grid gap-1">
              {title && <ToastPrimitives.Title className="text-sm font-semibold">{title}</ToastPrimitives.Title>}
              {description && (
                <ToastPrimitives.Description className="text-sm opacity-90">
                  {description}
                </ToastPrimitives.Description>
              )}
            </div>
            <ToastPrimitives.Close className="absolute right-2 top-2 rounded-md p-1 opacity-50 hover:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 transition-opacity">
              <X className="h-4 w-4" />
            </ToastPrimitives.Close>
          </ToastPrimitives.Root>
        )
      })}
      <ToastPrimitives.Viewport className="fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px] gap-2" />
    </ToastPrimitives.Provider>
  )
}
