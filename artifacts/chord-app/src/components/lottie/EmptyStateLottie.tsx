import AppLottie from './AppLottie';
import waveformData from '../../lottie/waveform-empty.json';

export type EmptyStateApp = 'chordex' | 'drumex' | 'vocalex' | 'stagex' | 'groovex' | 'generic';

interface EmptyStateLottieProps {
  app?: EmptyStateApp;
  size?: number;
  isLight?: boolean;
  style?: React.CSSProperties;
  opacity?: number;
}

export default function EmptyStateLottie({
  size = 56,
  isLight,
  style,
  opacity = 0.55,
}: EmptyStateLottieProps) {
  return (
    <AppLottie
      animationData={waveformData}
      loop
      autoplay
      isLight={isLight}
      style={{
        width: size,
        height: Math.round(size * (32 / 56)),
        opacity,
        ...style,
      }}
    />
  );
}
