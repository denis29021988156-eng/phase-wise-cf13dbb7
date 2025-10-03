import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-ring/20 focus:ring-offset-0",
  {
    variants: {
      variant: {
        default: "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/50",
        secondary: "border-border/30 bg-secondary/30 text-secondary-foreground hover:bg-secondary/50 hover:border-border/50",
        destructive: "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:border-destructive/50",
        outline: "border-border/30 text-foreground hover:bg-accent/5 hover:border-border/50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
