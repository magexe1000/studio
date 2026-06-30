import type { CSSProperties, ReactNode } from 'react';

interface GradientBorderCardProps {
  children: ReactNode;
  borderRadius?: number | string;
  wrapStyle?: CSSProperties;
  innerStyle?: CSSProperties;
  innerBg?: string;
  className?: string;
  [key: string]: any;
}

export default function GradientBorderCard({
  children,
  borderRadius = 16,
  wrapStyle,
  innerStyle,
  innerBg,
  className,
  ...rest
}: GradientBorderCardProps) {
  const br   = typeof borderRadius === 'number' ? `${borderRadius}px`     : borderRadius;
  const ibr  = typeof borderRadius === 'number' ? `${borderRadius - 1}px` : br;

  return (
    <div
      className={`gb-wrap${className ? ` ${className}` : ''}`}
      style={{ borderRadius: br, ...wrapStyle }}
      {...rest}
    >
      <div
        className="gb-inner"
        style={{
          borderRadius: ibr,
          ...(innerBg ? { '--gb-inner-bg': innerBg } as CSSProperties : {}),
          ...innerStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
}
