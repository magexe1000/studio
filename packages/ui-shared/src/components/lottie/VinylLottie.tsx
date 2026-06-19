import AppLottie from './AppLottie';
import animData from '../../lottie/vinyl-spin.json';

interface Props {
  size?: number;
  isLight?: boolean;
  style?: React.CSSProperties;
}

export default function VinylLottie({ size = 48, isLight = false, style }: Props) {
  return (
    <AppLottie
      animationData={animData}
      style={{
        width: size,
        height: size,
        filter: isLight ? 'invert(1)' : undefined,
        ...style,
      }}
    />
  );
}
