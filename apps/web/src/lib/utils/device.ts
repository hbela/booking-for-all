import { useEffect, useState } from "react";

/**
 * Hook to detect if the current viewport is mobile-sized
 * Uses 768px as the breakpoint (standard tablet/desktop breakpoint)
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    // Server-side: default to false
    if (typeof window === "undefined") return false;
    // Client-side: check initial viewport width
    return window.innerWidth <= 768;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    // Set initial value
    handleResize();

    // Add event listener
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isMobile;
}
