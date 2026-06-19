import { cn } from '@workspace/studio-core';
import type { ButtonHTMLAttributes, CSSProperties } from "react";

/**
 * AnimatedActionButton — Official Animata AnimatedBorderTrail adapted for
 * <button> usage. Spins a conic-gradient trail around the button border.
 *
 * @property --border-trail-angle must be registered in index.css for the
 * conic-gradient animation to interpolate correctly (it is).
 *
 * Only use on primary CTA buttons — Generate, Export, Update, Start Session.
 */

interface AnimatedActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Animation duration. Default "6s" is subtle. */
  duration?: string;
  /** Visible trail color. Defaults to the app accent-to CSS variable. */
  trailColor?: string;
  /** Trail arc size as % of circumference: sm=5% md=10% lg=20%. */
  trailSize?: "sm" | "md" | "lg";
  /** Extra Tailwind classes on the outer wrapper div. */
  wrapClassName?: string;
  /** Inline styles on the outer wrapper div (e.g. flex: 1, width). */
  wrapStyle?: CSSProperties;
  /** Extra Tailwind classes on the inner content div. */
  contentClassName?: string;
  /** Border-radius applied to wrapper, inner div, and button. Default 9999. */
  borderRadius?: string | number;
}

const trailPercent: Record<string, number> = { sm: 5, md: 10, lg: 20 };

export default function AnimatedActionButton({
  children,
  className,
  duration = "6s",
  trailColor = "var(--accent-to, #a78bfa)",
  trailSize = "sm",
  wrapClassName,
  wrapStyle,
  contentClassName,
  borderRadius = 9999,
  style,
  disabled,
  ...props
}: AnimatedActionButtonProps) {
  const br =
    typeof borderRadius === "number" ? `${borderRadius}px` : borderRadius;
  const innerBr = `calc(${br} - 1px)`;
  const pct = trailPercent[trailSize] ?? 5;

  return (
    <div
      className={cn("relative overflow-hidden p-px", wrapClassName)}
      style={{ borderRadius: br, display: "block", transform: "translateZ(0)", isolation: "isolate", ...wrapStyle }}
    >
      {/* Animata: rotating conic-gradient border layer */}
      <div
        className="absolute inset-0 h-full w-full"
        style={{
          borderRadius: br,
          animation: disabled
            ? "none"
            : `border-trail ${duration} linear infinite`,
          background: disabled
            ? "transparent"
            : `conic-gradient(from var(--border-trail-angle) at 50% 50%, transparent ${100 - pct}%, ${trailColor})`,
          willChange: "background",
        }}
      />
      {/* Animata: opaque inner layer — button bg covers the center */}
      <div
        className={cn("relative h-full w-full overflow-hidden", contentClassName)}
        style={{ borderRadius: innerBr }}
      >
        <button
          className={className}
          style={{ width: "100%", ...style }}
          disabled={disabled}
          {...props}
        >
          {children}
        </button>
      </div>
    </div>
  );
}
