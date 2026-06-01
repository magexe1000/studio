import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface StudioUpdateAuroraBackgroundProps extends React.HTMLProps<HTMLDivElement> {
  children?: React.ReactNode;
  showRadialGradient?: boolean;
  accentFrom: string;
  accentTo: string;
}

export default function StudioUpdateAuroraBackground({
  className,
  children,
  showRadialGradient = true,
  accentFrom,
  accentTo,
  ...props
}: StudioUpdateAuroraBackgroundProps) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

  // Soft purple-blue neutral fallbacks for the aurora color bands
  const c1 = accentFrom;
  const c2 = accentTo;
  const c3 = "var(--app-surface-high, rgba(128,128,128,0.15))";
  
  // Custom, dynamically-tinted linear gradient matching the app's visual identity!
  const auroraStyle: React.CSSProperties = {
    "--white-gradient": "radial-gradient(circle at 50% 50%, white 30%, transparent 100%)",
    "--dark-gradient": "radial-gradient(circle at 50% 50%, black 15%, transparent 100%)",
    "--transparent": "transparent",
    "--aurora": `repeating-linear-gradient(100deg, ${c1} 0%, ${c2} 8%, ${c3} 15%, ${c1} 22%, ${c2} 30%)`,
    position: "absolute",
    inset: "-10px",
    opacity: 0.38,
    filter: "blur(50px) saturate(1.4)",
    willChange: "transform",
    // Pause animation if the user prefers reduced motion
    animation: reducedMotion ? "none" : "studio-aurora 36s linear infinite",
  } as React.CSSProperties;

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center bg-zinc-950 text-slate-100 overflow-hidden w-full h-full",
        className
      )}
      {...props}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className={cn(
            "absolute inset-0 after:content-[''] after:absolute after:inset-0",
            "after:[background-image:var(--white-gradient),var(--aurora)] after:[background-size:300%,_200%]",
            "after:mix-blend-difference dark:after:mix-blend-screen",
            "[background-image:var(--dark-gradient),var(--aurora)] [background-size:300%,_200%]",
            showRadialGradient &&
              "[mask-image:radial-gradient(circle_at_50%_40%,black_30%,transparent_90%)]"
          )}
          style={auroraStyle}
        />
      </div>
      
      {/* Scope keyframe animations locally so they are fully self-contained */}
      <style>{`
        @keyframes studio-aurora {
          0% {
            background-position: 0% 50%, 0% 50%;
            transform: scale(1) rotate(0deg);
          }
          50% {
            background-position: 150% 100%, 150% 100%;
            transform: scale(1.08) rotate(2deg);
          }
          100% {
            background-position: 300% 50%, 300% 50%;
            transform: scale(1) rotate(0deg);
          }
        }
      `}</style>

      <div style={{ position: "relative", zIndex: 2, width: "100%", height: "100%" }}>
        {children}
      </div>
    </div>
  );
}
