import { cn } from "@/lib/utils";

interface StudioSpinnerProps {
  className?: string;
  outerSize?: string;
  childSize?: string;
  colorFrom?: string;
  colorTo?: string;
}

export default function StudioSpinner({
  className,
  outerSize,
  childSize,
  colorFrom = "var(--accent-from, #679cff)",
  colorTo = "var(--accent-to, #a78bfa)",
}: StudioSpinnerProps) {
  return (
    <div
      className={cn(
        "h-8 w-8 animate-spin items-center justify-center rounded-full p-0.5",
        className,
        outerSize,
      )}
      style={{ background: `linear-gradient(to bottom left, ${colorFrom}, ${colorTo})` }}
    >
      <div
        className={cn("h-6 w-6 rounded-full", childSize)}
        style={{ background: "var(--app-bg, #0f0f11)" }}
      />
    </div>
  );
}
