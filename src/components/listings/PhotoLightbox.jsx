import React, { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, X, Maximize2, Grid3x3 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function PhotoLightbox({ photos = [], initialIndex = 0, open, onOpenChange }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });
  const touchStartX = useRef(null);
  const lastPinchDist = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    resetView();
  }, [initialIndex, open]);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === "ArrowLeft") goTo((currentIndex - 1 + photos.length) % photos.length);
      else if (e.key === "ArrowRight") goTo((currentIndex + 1) % photos.length);
      else if (e.key === "Escape") onOpenChange(false);
      else if (e.key === "+" || e.key === "=") zoomIn();
      else if (e.key === "-") zoomOut();
      else if (e.key === "0") resetView();
      else if (e.key === "g") setShowGrid(g => !g);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, currentIndex]);

  const goTo = useCallback((idx) => {
    setCurrentIndex(idx);
    resetView();
    setShowGrid(false);
  }, []);

  const zoomIn = () => setZoom(z => Math.min(z + 0.5, 5));
  const zoomOut = () => {
    setZoom(z => {
      const next = Math.max(z - 0.5, 1);
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  // Double click to zoom
  const handleDoubleClick = (e) => {
    if (zoom > 1) {
      resetView();
    } else {
      setZoom(2.5);
      // Zoom toward click point
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const x = ((e.clientX - rect.left) / rect.width - 0.5) * -200;
        const y = ((e.clientY - rect.top) / rect.height - 0.5) * -200;
        setPan({ x, y });
      }
    }
  };

  // Mouse drag to pan (when zoomed)
  const handleMouseDown = (e) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    panStart.current = { ...pan };
  };

  const handleMouseMove = (e) => {
    if (!isDragging || zoom <= 1) return;
    setPan({
      x: panStart.current.x + (e.clientX - dragStart.current.x),
      y: panStart.current.y + (e.clientY - dragStart.current.y),
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Touch: swipe (when not zoomed) + pinch zoom
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist.current = Math.sqrt(dx * dx + dy * dy);
    } else if (e.touches.length === 1) {
      touchStartX.current = e.touches[0].clientX;
      if (zoom > 1) {
        dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        panStart.current = { ...pan };
        setIsDragging(true);
      }
    }
  };

  const handleTouchMove = (e) => {
    // Pinch zoom handled by non-passive useEffect listener above
    if (e.touches.length === 1 && zoom > 1 && isDragging) {
      setPan({
        x: panStart.current.x + (e.touches[0].clientX - dragStart.current.x),
        y: panStart.current.y + (e.touches[0].clientY - dragStart.current.y),
      });
    }
  };

  const handleTouchEnd = (e) => {
    lastPinchDist.current = null;
    setIsDragging(false);
    if (e.changedTouches.length === 1 && touchStartX.current !== null && zoom <= 1) {
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      if (Math.abs(dx) > 50) {
        if (dx < 0) goTo((currentIndex + 1) % photos.length);
        else goTo((currentIndex - 1 + photos.length) % photos.length);
      }
    }
    touchStartX.current = null;
  };

  // Scroll to zoom — must use non-passive listener via useEffect
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !open) return;
    const onWheel = (e) => {
      e.preventDefault();
      if (e.deltaY < 0) zoomIn();
      else zoomOut();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [open, zoom]);

  // Pinch-to-zoom — must use non-passive touchmove via useEffect
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !open) return;
    const onTouchMove = (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (lastPinchDist.current) {
          const scale = dist / lastPinchDist.current;
          setZoom(z => Math.min(Math.max(z * scale, 1), 5));
        }
        lastPinchDist.current = dist;
      }
    };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, [open]);

  if (photos.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[100vw] w-screen h-screen p-0 bg-black/95 border-0 rounded-none sm:rounded-none flex flex-col [&>button]:hidden" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Photo gallery — {currentIndex + 1} of {photos.length}</DialogTitle>

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent">
          <div className="flex items-center gap-3">
            <span className="text-white/90 text-sm font-medium">
              {currentIndex + 1} / {photos.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {photos.length > 1 && (
              <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/10 rounded-full w-9 h-9" onClick={() => setShowGrid(g => !g)}>
                <Grid3x3 className="w-4 h-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/10 rounded-full w-9 h-9" onClick={resetView}>
              <Maximize2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/10 rounded-full w-9 h-9" onClick={() => onOpenChange(false)}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Grid view overlay */}
        <AnimatePresence>
          {showGrid && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 bg-black/95 overflow-y-auto p-4 pt-16"
            >
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-w-5xl mx-auto">
                {photos.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => goTo(i)}
                    className={`aspect-square rounded-lg overflow-hidden border-2 transition-all hover:scale-[1.03] ${i === currentIndex ? "border-white ring-2 ring-white/30" : "border-transparent hover:border-white/40"}`}
                  >
                    <img src={p} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main image area */}
        <div
          ref={containerRef}
          className="flex-1 flex items-center justify-center overflow-hidden relative"
          onDoubleClick={handleDoubleClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "zoom-in", touchAction: "none" }}
        >
          <AnimatePresence mode="wait">
            <motion.img
              key={currentIndex}
              src={photos[currentIndex]}
              alt={`Photo ${currentIndex + 1} of ${photos.length}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="select-none max-h-[85vh] max-w-[95vw] sm:max-w-[90vw] object-contain"
              style={{
                transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                transition: isDragging ? "none" : "transform 0.2s ease-out",
              }}
              draggable={false}
            />
          </AnimatePresence>

          {/* Navigation arrows — only when not zoomed */}
          {photos.length > 1 && zoom <= 1 && (
            <>
              <button
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/80 hover:bg-black/60 hover:text-white transition-all"
                onClick={(e) => { e.stopPropagation(); goTo((currentIndex - 1 + photos.length) % photos.length); }}
              >
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <button
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/80 hover:bg-black/60 hover:text-white transition-all"
                onClick={(e) => { e.stopPropagation(); goTo((currentIndex + 1) % photos.length); }}
              >
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </>
          )}
        </div>

        {/* Bottom bar — zoom controls + thumbnails */}
        <div className="absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/80 to-transparent">
          {/* Thumbnail strip */}
          {photos.length > 1 && (
            <div className="flex justify-center gap-1.5 px-4 py-2 overflow-x-auto">
              {photos.map((p, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={`w-12 h-9 sm:w-14 sm:h-10 rounded-md overflow-hidden flex-shrink-0 transition-all ${
                    i === currentIndex
                      ? "ring-2 ring-white scale-110 opacity-100"
                      : "opacity-50 hover:opacity-80"
                  }`}
                >
                  <img src={p} alt="" className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}

          {/* Zoom controls */}
          <div className="flex items-center justify-center gap-3 px-4 py-3">
            <div className="flex items-center gap-1 bg-white/10 backdrop-blur-sm rounded-full px-1">
              <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/10 rounded-full w-8 h-8" onClick={zoomOut} disabled={zoom <= 1}>
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <span className="text-white/70 text-xs font-medium min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
              <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/10 rounded-full w-8 h-8" onClick={zoomIn} disabled={zoom >= 5}>
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
            </div>
            <span className="text-white/40 text-[10px] hidden sm:block">Double-click to zoom • Scroll to zoom • Drag to pan</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
