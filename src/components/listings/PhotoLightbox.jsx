import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, X } from "lucide-react";
import { motion } from "framer-motion";

export default function PhotoLightbox({ photos = [], initialIndex = 0, open, onOpenChange }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const lastPinchDistance = useRef(null);
  const lastZoom = useRef(1);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setZoom(1);
    lastZoom.current = 1;
  }, [initialIndex, open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "Escape") onOpenChange(false);
      if (e.key === "+") handleZoomIn();
      if (e.key === "-") handleZoomOut();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, currentIndex, zoom]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % photos.length);
    setZoom(1);
    lastZoom.current = 1;
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
    setZoom(1);
    lastZoom.current = 1;
  };

  const handleZoomIn = () => {
    setZoom((prev) => {
      const next = Math.min(prev + 0.25, 4);
      lastZoom.current = next;
      return next;
    });
  };

  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(prev - 0.25, 1);
      lastZoom.current = next;
      return next;
    });
  };

  const getPinchDistance = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      lastPinchDistance.current = getPinchDistance(e.touches);
    } else if (e.touches.length === 1) {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const distance = getPinchDistance(e.touches);
      if (lastPinchDistance.current !== null) {
        const scale = distance / lastPinchDistance.current;
        setZoom((prev) => {
          const next = Math.min(Math.max(prev * scale, 1), 4);
          lastZoom.current = next;
          return next;
        });
      }
      lastPinchDistance.current = distance;
    }
  };

  const handleTouchEnd = (e) => {
    if (e.touches.length < 2) {
      lastPinchDistance.current = null;
    }
    if (e.changedTouches.length === 1 && touchStartX.current !== null && lastZoom.current <= 1) {
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = e.changedTouches[0].clientY - touchStartY.current;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
        if (dx < 0) handleNext();
        else handlePrev();
      } else if (dy > 80 && Math.abs(dy) > Math.abs(dx)) {
        onOpenChange(false);
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  if (photos.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-screen sm:h-auto p-0 bg-black border-0 rounded-lg overflow-hidden flex flex-col" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Photo gallery</DialogTitle>
        {/* Image Container */}
        <div
          className="relative w-full flex-1 flex items-center justify-center bg-black overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ touchAction: "none" }}
        >
          <motion.img
            key={currentIndex}
            src={photos[currentIndex]}
            alt={`Photo ${currentIndex + 1}`}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ 
              transform: `scale(${zoom})`,
              maxHeight: "80vh",
              maxWidth: "100%",
              objectFit: "contain",
              cursor: zoom > 1 ? "grab" : "auto"
            }}
            className="transition-transform duration-200 select-none"
            draggable={false}
            loading="lazy"
            decoding="async"
          />

          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/80 rounded-full w-10 h-10 border border-white/30"
            onClick={() => onOpenChange(false)}
          >
            <X className="w-5 h-5" />
          </Button>

          {/* Navigation Arrows */}
          {photos.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 rounded-full"
                onClick={handlePrev}
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 rounded-full"
                onClick={handleNext}
              >
                <ChevronRight className="w-6 h-6" />
              </Button>
            </>
          )}

          {/* Zoom Controls - Desktop only */}
          <div className="hidden sm:flex absolute bottom-4 left-1/2 -translate-x-1/2 gap-2 bg-black/50 backdrop-blur-sm rounded-full p-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 rounded-full w-9 h-9"
              onClick={handleZoomOut}
              disabled={zoom <= 1}
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-white text-sm px-2 py-1 flex items-center min-w-12">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 rounded-full w-9 h-9"
              onClick={handleZoomIn}
              disabled={zoom >= 3}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Info Bar */}
        <div className="bg-black/80 backdrop-blur-sm px-4 py-3 flex items-center justify-between text-white text-sm border-t border-white/10">
          <span>
            Photo {currentIndex + 1} of {photos.length}
          </span>
          {/* Dot indicators on mobile */}
          {photos.length > 1 && (
            <div className="flex gap-1.5 sm:hidden">
              {photos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setCurrentIndex(i); setZoom(1); }}
                  className={`w-2 h-2 rounded-full transition-colors ${i === currentIndex ? "bg-white" : "bg-white/30"}`}
                />
              ))}
            </div>
          )}
          <span className="text-white/60 text-xs hidden sm:block">
            Arrow keys to navigate • +/- to zoom • ESC to close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}