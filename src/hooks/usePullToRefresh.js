import { useState, useRef, useEffect } from "react";

const THRESHOLD = 70;

export default function usePullToRefresh(onRefresh) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current || window;

    const onTouchStart = (e) => {
      const scrollTop = containerRef.current
        ? containerRef.current.scrollTop
        : document.documentElement.scrollTop;
      if (scrollTop === 0) {
        startY.current = e.touches[0].clientY;
      }
    };

    const onTouchMove = (e) => {
      if (startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0) {
        setPulling(true);
        setPullDistance(Math.min(dy, THRESHOLD * 1.5));
      }
    };

    const onTouchEnd = async () => {
      if (pullDistance >= THRESHOLD) {
        setRefreshing(true);
        await onRefresh();
        setRefreshing(false);
      }
      setPulling(false);
      setPullDistance(0);
      startY.current = null;
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [onRefresh, pullDistance]);

  return { pulling, refreshing, pullDistance, containerRef, threshold: THRESHOLD };
}