import AppLottie from './AppLottie';
import successData from '../../lottie/success.json';

interface SuccessLottieProps {
  size?: number;
  isLight?: boolean;
  onComplete?: () => void;
  style?: React.CSSProperties;
}

export default function SuccessLottie({
  size = 44,
  isLight,
  onComplete,
  style,
}: SuccessLottieProps) {
  return (
    <AppLottie
      animationData={successData}
      loop={false}
      autoplay
      isLight={isLight}
      onComplete={onComplete}
      style={{ width: size, height: size, ...style }}
    />
  );
}
