import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { CircleNotch } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent text-sm font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] duration-150 outline-none select-none focus-visible:ring-3 focus-visible:ring-brand/30 focus-visible:border-brand active:not-disabled:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.14),0_1px_2px_oklch(0.2_0.02_262/0.25)] hover:bg-primary/88",
        brand:
          "bg-brand text-brand-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.18),0_1px_2px_oklch(0.3_0.1_262/0.3)] hover:bg-brand/90",
        outline:
          "border-input bg-card text-foreground shadow-panel hover:border-foreground/25 hover:bg-muted aria-expanded:bg-muted",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted",
        danger:
          "border-destructive/30 bg-card text-destructive-fg shadow-panel hover:border-destructive/50 hover:bg-destructive/8",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        link: "h-auto px-0 text-brand underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-7 px-2 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 px-3 text-[13px] [&_svg:not([class*='size-'])]:size-4",
        default: "h-9 px-3.5 [&_svg:not([class*='size-'])]:size-4",
        lg: "h-10 px-4 [&_svg:not([class*='size-'])]:size-4",
        icon: "size-9 [&_svg:not([class*='size-'])]:size-4",
        "icon-sm": "size-8 [&_svg:not([class*='size-'])]:size-4",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants> & { loading?: boolean }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <CircleNotch className="animate-spin" aria-hidden />}
      {children}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
