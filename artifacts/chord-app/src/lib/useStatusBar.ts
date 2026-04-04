import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();

function getThemeColors(theme: string, amoledMode: boolean) {
  const systemIsLight =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: light)').matches;
  const isLight =
    theme === 'light' || (theme === 'system' && systemIsLight);

  if (amoledMode) return isLight
    ? { bg: '#ffffff', style: 'LIGHT' as const }
    : { bg: '#000000', style: 'DARK'  as const };
  if (isLight)    return { bg: '#f2f1ef', style: 'LIGHT' as const };
  return            { bg: '#0e0e0e',    style: 'DARK' as const };
}

export function useStatusBar(theme: string, amoledMode: boolean) {
  useEffect(() => {
    if (!isNative) return;

    const { bg, style } = getThemeColors(theme, amoledMode);

    import('@capacitor/status-bar')
      .then(({ StatusBar, Style }) => {
        StatusBar.show();
        StatusBar.setOverlaysWebView({ overlay: false });
        StatusBar.setBackgroundColor({ color: bg });
        StatusBar.setStyle({ style: style === 'DARK' ? Style.Dark : Style.Light });
      })
      .catch(() => {});
  }, [theme, amoledMode]);
}
