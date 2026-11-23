import { useEffect, useState } from "react";

/** Whether the reader asked for reduced motion; follows the setting as it changes. */
export function useReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

/** Whether a media query matches; follows it as the window or setting changes. */
export function useMediaQuery(query: string): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setReduced(list.matches);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);
  return reduced;
}
