import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * ✨ Modern Button Component - Material 3 Inspired
 * Features: Ripple effect, smooth transitions, enhanced hover states
 */

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all overflow-hidden group disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-md hover:shadow-lg active:shadow-sm hover:scale-[1.02] active:scale-[0.98]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-md hover:shadow-lg active:shadow-sm hover:scale-[1.02] active:scale-[0.98]",
        outline:
          "border-2 border-border bg-background hover:bg-accent hover:border-accent-foreground/20 hover:text-accent-foreground active:scale-[0.98]",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary-hover hover:shadow-md active:scale-[0.98]",
        ghost: 
          "hover:bg-accent hover:text-accent-foreground active:scale-95",
        link: 
          "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2 text-sm rounded-lg",
        sm: "h-8 px-3 text-xs rounded-md",
        lg: "h-12 px-8 text-base rounded-xl",
        icon: "h-10 w-10 rounded-lg",
        "icon-sm": "h-8 w-8 rounded-md",
        "icon-lg": "h-12 w-12 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /**
   * Enable ripple effect on click (Material 3)
   */
  ripple?: boolean;
}

/**
 * Button component with modern Material 3 design
 * 
 * @example
 * <Button variant="default" size="lg" ripple onClick={() => console.log('clicked')}>
 *   Click me
 * </Button>
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ripple = true, onClick, children, ...props }, ref) => {
    const buttonRef = React.useRef<HTMLButtonElement>(null);

    // Merge refs
    React.useImperativeHandle(ref, () => buttonRef.current as HTMLButtonElement);

    // Ripple effect handler
    const createRipple = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
      if (!ripple || variant === "link" || variant === "ghost") return;

      const button = event.currentTarget;
      const circle = document.createElement("span");
      const diameter = Math.max(button.clientWidth, button.clientHeight);
      const radius = diameter / 2;

      // Calculate position
      const rect = button.getBoundingClientRect();
      circle.style.width = circle.style.height = `${diameter}px`;
      circle.style.left = `${event.clientX - rect.left - radius}px`;
      circle.style.top = `${event.clientY - rect.top - radius}px`;
      circle.classList.add("ripple");

      // Remove existing ripples
      const existingRipple = button.getElementsByClassName("ripple")[0];
      if (existingRipple) {
        existingRipple.remove();
      }

      button.appendChild(circle);

      // Remove ripple after animation
      setTimeout(() => {
        circle.remove();
      }, 600);
    }, [ripple, variant]);

    const handleClick = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
      createRipple(event);
      onClick?.(event);
    }, [createRipple, onClick]);

    return (
      <>
        <style>{`
          .ripple {
            position: absolute;
            border-radius: 50%;
            background-color: rgba(255, 255, 255, 0.6);
            transform: scale(0);
            animation: ripple-animation 600ms ease-out;
            pointer-events: none;
          }

          @keyframes ripple-animation {
            to {
              transform: scale(4);
              opacity: 0;
            }
          }

          /* Shimmer effect on hover */
          .group:hover::before {
            content: "";
            position: absolute;
            inset: 0;
            background: linear-gradient(
              90deg,
              transparent,
              rgba(255, 255, 255, 0.1),
              transparent
            );
            animation: shimmer 1.5s infinite;
          }

          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
        <button
          ref={buttonRef}
          className={cn(buttonVariants({ variant, size, className }))}
          onClick={handleClick}
          {...props}
        >
          {children}
        </button>
      </>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants }; 