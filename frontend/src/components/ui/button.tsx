import { forwardRef, type ButtonHTMLAttributes, type ElementType } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-primary text-white hover:bg-primary-dark',
        secondary: 'bg-surface-alt text-text border border-border hover:bg-surface',
        outline: 'border border-border bg-transparent hover:bg-surface-alt',
        ghost: 'hover:bg-surface-alt',
        danger: 'bg-danger text-white hover:bg-red-600',
        success: 'bg-success text-white hover:bg-green-600',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-6',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp: ElementType = asChild ? Slot : 'button'
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
