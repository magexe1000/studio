"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useInView } from "motion/react";
import { cn } from "@/lib/utils";

type EncryptedTextProps = {
  text: string;
  className?: string;
  /**
   * Time in milliseconds between revealing each subsequent real character.
   * Lower is faster. Defaults to 50ms per character.
   */
  revealDelayMs?: number;
  /** Optional custom character set to use for the gibberish effect. */
  charset?: string;
  /**
   * Time in milliseconds between gibberish flips for unrevealed characters.
   * Lower is more jittery. Defaults to 50ms.
   */
  flipDelayMs?: number;
  /** CSS class for styling the encrypted/scrambled characters */
  encryptedClassName?: string;
  /** CSS class for styling the revealed characters */
  revealedClassName?: string;
  /** If true, the animation will only run once per app launch session */
  onlyOnce?: boolean;
  /** If true, scramble continuously without revealing characters */
  paused?: boolean;
};

const DEFAULT_CHARSET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-={}[];:,.<>/?";

// Cache to track which texts have already animated in the current app session
const animatedTextsCache = new Set<string>();

function generateRandomCharacter(charset: string): string {
  const index = Math.floor(Math.random() * charset.length);
  return charset.charAt(index);
}

function generateGibberishPreservingSpaces(
  original: string,
  charset: string,
): string {
  if (!original) return "";
  let result = "";
  for (let i = 0; i < original.length; i += 1) {
    const ch = original[i];
    result += ch === " " ? " " : generateRandomCharacter(charset);
  }
  return result;
}

export const EncryptedText: React.FC<EncryptedTextProps> = ({
  text,
  className,
  revealDelayMs = 50,
  charset = DEFAULT_CHARSET,
  flipDelayMs = 50,
  encryptedClassName,
  revealedClassName,
  onlyOnce = false,
  paused = false,
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  
  // Standard IntersectionObserver visibility hook from Framer Motion
  const inViewSignal = useInView(ref, { once: true });
  const [isInView, setIsInView] = useState(false);

  // Checks if this specific text has already completed decryption during this launch session
  const alreadyAnimated = onlyOnce && animatedTextsCache.has(text);

  // Track if this instance has finished animating during this mount lifecycle
  const hasAnimatedRef = useRef(alreadyAnimated);
  const isAnimated = alreadyAnimated || hasAnimatedRef.current;

  const [revealCount, setRevealCount] = useState<number>(() =>
    isAnimated ? text.length : 0
  );

  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastFlipTimeRef = useRef<number>(0);
  const scrambleCharsRef = useRef<string[]>(
    text ? generateGibberishPreservingSpaces(text, charset).split("") : [],
  );

  // Sync state if IntersectionObserver reports visible
  useEffect(() => {
    if (inViewSignal) {
      setIsInView(true);
    }
  }, [inViewSignal]);

  // Robust Visibility Fallback:
  // If IntersectionObserver is blocked, delayed, or disabled due to styling/zoom transitions,
  // we force the animation to begin after 150ms so that the text never remains stuck or scrambled.
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInView(true);
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isInView || isAnimated) {
      if (isInView && onlyOnce) {
        animatedTextsCache.add(text);
      }
      return;
    }

    // Reset state for a fresh animation
    const initial = text
      ? generateGibberishPreservingSpaces(text, charset)
      : "";
    scrambleCharsRef.current = initial.split("");
    startTimeRef.current = performance.now();
    lastFlipTimeRef.current = startTimeRef.current;
    setRevealCount(0);
    if (!paused) {
      animatedTextsCache.add(text);
    }

    let isCancelled = false;

    const update = (now: number) => {
      if (isCancelled) return;

      const totalLength = text.length;
      let currentRevealCount = 0;

      if (paused) {
        // Keep shifting the start time so the elapsed duration stays 0,
        // but let the character scrambling logic run below continuously.
        startTimeRef.current = now;
      } else {
        const elapsedMs = now - startTimeRef.current;
        currentRevealCount = Math.min(
          totalLength,
          Math.floor(elapsedMs / Math.max(1, revealDelayMs)),
        );
      }

      setRevealCount(currentRevealCount);

      if (!paused && currentRevealCount >= totalLength) {
        hasAnimatedRef.current = true;
        if (onlyOnce) {
          animatedTextsCache.add(text);
        }
        return;
      }

      // Re-randomize unrevealed scramble characters on an interval
      const timeSinceLastFlip = now - lastFlipTimeRef.current;
      if (timeSinceLastFlip >= Math.max(0, flipDelayMs)) {
        for (let index = 0; index < totalLength; index += 1) {
          if (index >= currentRevealCount) {
            if (text[index] !== " ") {
              scrambleCharsRef.current[index] =
                generateRandomCharacter(charset);
            } else {
              scrambleCharsRef.current[index] = " ";
            }
          }
        }
        lastFlipTimeRef.current = now;
      }

      animationFrameRef.current = requestAnimationFrame(update);
    };

    animationFrameRef.current = requestAnimationFrame(update);

    return () => {
      isCancelled = true;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isInView, text, revealDelayMs, charset, flipDelayMs, onlyOnce, isAnimated, paused]);

  if (!text) return null;

  return (
    <motion.span
      ref={ref}
      className={cn(className)}
      aria-label={text}
      role="text"
    >
      {text.split("").map((char, index) => {
        const isRevealed = isAnimated || index < revealCount;
        const displayChar = isRevealed
          ? char
          : char === " "
            ? " "
            : (scrambleCharsRef.current[index] ??
              generateRandomCharacter(charset));

        return (
          <span
            key={index}
            className={cn(isRevealed ? revealedClassName : encryptedClassName)}
          >
            {displayChar}
          </span>
        );
      })}
    </motion.span>
  );
};
