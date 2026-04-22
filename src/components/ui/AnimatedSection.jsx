import React from "react";
import { motion } from "framer-motion";

/**
 * AnimatedSection — wraps any section in a scroll-triggered reveal animation.
 * Uses framer-motion's whileInView for performance (only animates when visible).
 * 
 * Variants:
 *  - "fadeUp" (default): fade in + slide up
 *  - "fadeIn": simple fade
 *  - "slideLeft": slide in from left
 *  - "slideRight": slide in from right
 *  - "scale": scale up from 95%
 *  - "stagger": container for staggered children
 */

const VARIANTS = {
  fadeUp: {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0 },
  },
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
  slideLeft: {
    hidden: { opacity: 0, x: -60 },
    visible: { opacity: 1, x: 0 },
  },
  slideRight: {
    hidden: { opacity: 0, x: 60 },
    visible: { opacity: 1, x: 0 },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.92 },
    visible: { opacity: 1, scale: 1 },
  },
};

export default function AnimatedSection({
  children,
  variant = "fadeUp",
  delay = 0,
  duration = 0.7,
  className = "",
  once = true,
  amount = 0.15,
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount }}
      variants={VARIANTS[variant] || VARIANTS.fadeUp}
      transition={{
        duration,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94], // Smooth luxury easing
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * StaggerContainer — wraps children in a stagger animation.
 * Each direct child animates in sequence with a delay.
 */
export function StaggerContainer({
  children,
  staggerDelay = 0.12,
  className = "",
  once = true,
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount: 0.1 }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: staggerDelay } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * StaggerItem — child of StaggerContainer.
 */
export function StaggerItem({ children, className = "" }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 30 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * CountUp — animated number counter that counts up when scrolled into view.
 */
export function CountUp({ end, suffix = "", prefix = "", duration = 2 }) {
  const [count, setCount] = React.useState(0);
  const [hasAnimated, setHasAnimated] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const endNum = typeof end === "string" ? parseInt(end.replace(/[^0-9]/g, "")) : end;
          const startTime = performance.now();
          const animate = (now) => {
            const elapsed = (now - startTime) / (duration * 1000);
            if (elapsed < 1) {
              setCount(Math.floor(endNum * easeOutCubic(elapsed)));
              requestAnimationFrame(animate);
            } else {
              setCount(endNum);
            }
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration, hasAnimated]);

  return (
    <span ref={ref}>
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  );
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}
