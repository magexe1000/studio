import React, { useState, useEffect } from 'react';

interface SmartLoadingProps {
  fallbackSkeleton: React.ReactNode;
  subtleLoading?: React.ReactNode;
  delayMs?: number;      // threshold for showing subtle loading (150ms)
  skeletonMs?: number;  // threshold for showing full skeleton (400ms)
}

export default function SmartLoading({
  fallbackSkeleton,
  subtleLoading,
  delayMs = 150,
  skeletonMs = 400,
}: SmartLoadingProps) {
  const [loadState, setLoadState] = useState<'none' | 'subtle' | 'skeleton'>('none');

  useEffect(() => {
    const subtleTimer = setTimeout(() => {
      setLoadState('subtle');
    }, delayMs);

    const skeletonTimer = setTimeout(() => {
      setLoadState('skeleton');
    }, skeletonMs);

    return () => {
      clearTimeout(subtleTimer);
      clearTimeout(skeletonTimer);
    };
  }, [delayMs, skeletonMs]);

  if (loadState === 'none') {
    return null;
  }

  if (loadState === 'subtle') {
    return subtleLoading ? (
      <>{subtleLoading}</>
    ) : (
      <div className="studio-accent-loader">
        <div className="studio-accent-loader-bar" />
      </div>
    );
  }

  return (
    <div style={{ animation: 'skeleton-fade-in 300ms ease both' }}>
      <style>{`
        @keyframes skeleton-fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {fallbackSkeleton}
    </div>
  );
}
