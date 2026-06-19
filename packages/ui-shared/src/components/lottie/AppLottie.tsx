import { lazy, Suspense } from 'react';

const LottiePlayer = lazy(() => import('lottie-react'));

export interface AppLottieProps {
  animationData: object;
  loop?: boolean;
  autoplay?: boolean;
  style?: React.CSSProperties;
  className?: string;
  onComplete?: () => void;
  isLight?: boolean;
}

export default function AppLottie({
  animationData,
  loop = true,
  autoplay = true,
  style,
  className,
  onComplete,
  isLight,
}: AppLottieProps) {
  const colorFilter = isLight ? 'invert(1)' : undefined;
  return (
    <Suspense fallback={null}>
      <LottiePlayer
        animationData={animationData}
        loop={loop}
        autoplay={autoplay}
        className={className}
        onComplete={onComplete}
        style={{ filter: colorFilter, ...style }}
        rendererSettings={{ preserveAspectRatio: 'xMidYMid meet' }}
      />
    </Suspense>
  );
}
