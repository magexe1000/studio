import AppLottie from './AppLottie';
import updateData from '../../lottie/update-pulse.json';

interface UpdateLottieProps {
  size?: number;
  style?: React.CSSProperties;
}

export default function UpdateLottie({ size = 28, style }: UpdateLottieProps) {
  return (
    <AppLottie
      animationData={updateData}
      loop
      autoplay
      style={{ width: size, height: size, ...style }}
    />
  );
}
