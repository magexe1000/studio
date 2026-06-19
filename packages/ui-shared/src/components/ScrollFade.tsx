import { useState, useEffect, useRef } from 'react';

export function useScrollFade() {
  const ref = useRef<HTMLDivElement>(null);
  const [fadeClass, setFadeClass] = useState<'fade-none' | 'fade-left' | 'fade-right' | 'fade-both'>('fade-none');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const updateScrollFade = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      
      // If content fits within container, no fade is needed
      if (scrollWidth <= clientWidth) {
        setFadeClass('fade-none');
        return;
      }

      const isAtStart = scrollLeft <= 2;
      const isAtEnd = scrollLeft + clientWidth >= scrollWidth - 2;

      if (isAtStart) {
        setFadeClass('fade-right');
      } else if (isAtEnd) {
        setFadeClass('fade-left');
      } else {
        setFadeClass('fade-both');
      }
    };

    updateScrollFade();

    // Listen to scroll events
    el.addEventListener('scroll', updateScrollFade, { passive: true });

    // Monitor resize events of the element
    const resizeObserver = new ResizeObserver(() => {
      updateScrollFade();
    });
    resizeObserver.observe(el);
    
    // Monitor changes in child nodes (e.g. dynamic genre chips loading)
    const mutationObserver = new MutationObserver(() => {
      updateScrollFade();
    });
    mutationObserver.observe(el, { childList: true, subtree: true });

    return () => {
      el.removeEventListener('scroll', updateScrollFade);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  return { ref, fadeClass };
}
