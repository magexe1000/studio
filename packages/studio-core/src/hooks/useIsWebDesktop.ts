import { useState, useEffect } from 'react';
import { isWebRuntime } from '../lib/capgoUpdater';

export function useIsWebDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => {
    return isWebRuntime() && typeof window !== 'undefined' && window.innerWidth >= 768;
  });

  useEffect(() => {
    if (!isWebRuntime()) return;

    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isDesktop;
}
