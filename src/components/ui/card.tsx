import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

/**
 * ✨ Modern Card Component - Material 3 Inspired
 * Features: Enhanced shadows, smooth hover transitions, visual depth
 */

const cardVariants = cva(
  "rounded-xl border transition-all duration-300",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground border-border shadow-md hover:shadow-lg",
        elevated: "bg-card text-card-foreground border-border shadow-lg hover:shadow-xl hover:-translate-y-1",
        outlined: "bg-card text-card-foreground border-2 border-border hover:border-border-hover",
        filled: "bg-muted text-card-foreground border-transparent shadow-sm hover:shadow-md",
        interactive: "bg-card text-card-foreground border-border shadow-md hover:shadow-xl hover:scale-[1.02] cursor-pointer transition-transform",
      },
      padding: {
        none: "p-0",
        sm: "p-4",
        default: "p-6",
        lg: "p-8",
      },
    },
    defaultVariants: {
      variant: "default",
      padding: "default",
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  /**
   * Enable hover glow effect
   */
  glow?: boolean;
}

/**
 * Card component - A container with consistent styling and sections
 * 
 * @example
 * <Card variant="elevated" glow>
 *   <CardHeader>
 *     <CardTitle>Card Title</CardTitle>
 *     <CardDescription>Card description</CardDescription>
 *   </CardHeader>
 *   <CardContent>
 *     Content goes here
 *   </CardContent>
 *   <CardFooter>
 *     Footer content
 *   </CardFooter>
 * </Card>
 */
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, glow = false, ...props }, ref) => (
    <>
      {glow && (
        <style>{`
          .card-glow {
            position: relative;
          }
          
          .card-glow::before {
            content: "";
            position: absolute;
            inset: -2px;
            border-radius: inherit;
            padding: 2px;
            background: linear-gradient(
              135deg,
              var(--color-primary),
              var(--color-accent)
            );
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask-composite: exclude;
            opacity: 0;
            transition: opacity 300ms;
          }
          
          .card-glow:hover::before {
            opacity: 0.8;
          }
        `}</style>
      )}
      <div
        ref={ref}
        className={cn(
          cardVariants({ variant, padding }),
          glow && "card-glow",
          className
        )}
        {...props}
      />
    </>
  )
);
Card.displayName = "Card";

/**
 * CardHeader component - Top section of a card
 */
const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

/**
 * CardTitle component - Main title within CardHeader
 */
const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

/**
 * CardDescription component - Descriptive text within CardHeader
 */
const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

/**
 * CardContent component - Main content area of a card
 */
const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

/**
 * CardFooter component - Bottom section of a card
 */
const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }; 