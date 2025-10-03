import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[--radius] text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.5]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:shadow-[var(--shadow-glow)] hover:scale-[1.02]",
        destructive: "border border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10 hover:border-destructive/50",
        outline: "border border-border/30 bg-transparent hover:border-border/50 hover:bg-accent/5",
        secondary: "border border-border/20 bg-secondary/50 text-secondary-foreground hover:bg-secondary/70 hover:border-border/30",
        ghost: "hover:bg-accent/5 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline hover:opacity-80",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-[calc(var(--radius)-0.25rem)] px-3",
        lg: "h-11 rounded-[calc(var(--radius)+0.25rem)] px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
