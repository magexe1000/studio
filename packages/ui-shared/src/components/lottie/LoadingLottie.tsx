import AppLottie from './AppLottie';
import loadingData from '../../lottie/loading-dots.json';

interface LoadingLottieProps {
  width?: number;
  isLight?: boolean;
  style?: React.CSSProperties;
}

export default function LoadingLottie({ width = 48, isLight, style }: LoadingLottieProps) {
  return (
    <AppLottie
      animationData={loadingData}
      loop
      autoplay
      isLight={isLight}
      style={{
        width,
        height: Math.round(width * (16 / 56)),
        ...style,
      }}
    />
  );
}
