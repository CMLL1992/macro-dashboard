import * as React from 'react'
import { cn } from '@/components/ui/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
          variant === 'default' &&
            'bg-primary text-primary-foreground hover:bg-primary/90 shadow',
          variant === 'outline' &&
            'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
          variant === 'ghost' && 'hover:bg-accent hover:text-accent-foreground',
          size === 'sm' && 'h-8 px-3 text-xs',
          size === 'md' && 'h-10 px-4 py-2 text-sm',
          size === 'lg' && 'h-12 px-6 text-base',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button }
