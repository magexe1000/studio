import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

interface AnimatedBorderButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  borderRadius?: number | string;
  speed?: number;
  wrapStyle?: CSSProperties;
}

/**
 * Button wrapped with the rotating gradient border trail.
 * Uses the existing gb-border-ring CSS (@property --gb-angle / gb-spin animation).
 * Only apply to important primary actions — not every button.
 */
export default function AnimatedBorderButton({
  children,
  borderRadius = 9999,
  speed = 4,
  wrapStyle,
  style,
  className,
  ...props
}: AnimatedBorderButtonProps) {
  const br = typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius;

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: br,
        display: 'block',
        ...wrapStyle,
      }}
    >
      <div
        className="gb-border-ring"
        style={
          {
            '--gb-dur': `${speed}s`,
            '--gb-mix': '65%',
            borderRadius: br,
          } as CSSProperties
        }
      />
      <button
        className={className}
        style={{
          position: 'relative',
          zIndex: 1,
          borderRadius: br,
          width: '100%',
          ...style,
        }}
        {...props}
      >
        {children}
      </button>
    </div>
  );
}
