import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

/**
 * ✨ Modern Input Component - Material 3 Inspired
 * Features: Smooth focus transitions, enhanced borders, floating effects
 */

const inputVariants = cva(
  "flex w-full rounded-lg border-2 px-4 py-2.5 text-sm transition-all duration-300 placeholder:text-muted-foreground",
  {
    variants: {
      variant: {
        default:
          "bg-input border-border hover:border-border-hover focus:border-primary focus:bg-background focus:shadow-md focus:shadow-primary/5",
        filled:
          "bg-muted border-transparent hover:bg-muted-hover focus:bg-background focus:border-primary focus:shadow-md focus:shadow-primary/5",
        ghost:
          "bg-transparent border-transparent hover:bg-muted/50 focus:bg-background focus:border-primary",
      },
      inputSize: {
        sm: "h-8 px-3 py-1.5 text-xs rounded-md",
        default: "h-10 px-4 py-2.5 text-sm rounded-lg",
        lg: "h-12 px-5 py-3 text-base rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      inputSize: "default",
    },
  }
);

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {
  /**
   * Show animated border glow on focus
   */
  glow?: boolean;
}

/**
 * Input component for text/number inputs with modern styling
 * 
 * @example
 * <Input 
 *   type="text" 
 *   placeholder="Enter value..." 
 *   variant="filled"
 *   glow
 * />
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant, inputSize, glow = false, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);

    return (
      <div className="relative">
        {glow && (
          <style>{`
            .input-glow-container {
              position: relative;
            }
            
            .input-glow-border {
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
              pointer-events: none;
            }
            
            .input-glow-container.focused .input-glow-border {
              opacity: 0.6;
            }
          `}</style>
        )}
        <div className={cn(glow && "input-glow-container", isFocused && "focused")}>
          {glow && <div className="input-glow-border" />}
          <input
            type={type}
            className={cn(
              inputVariants({ variant, inputSize }),
              "file:border-0 file:bg-transparent file:text-sm file:font-medium",
              "focus-visible:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-50",
              className
            )}
            ref={ref}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            {...props}
          />
        </div>
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input }; 