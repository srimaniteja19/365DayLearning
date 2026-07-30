"use client";

import type { CSSProperties, ReactNode } from "react";
import { motion } from "motion/react";
import { useTilt3D } from "@/features/landing/use3d";

type TiltCardProps = {
  children: ReactNode;
  className?: string;
  maxTilt?: number;
  hoverScale?: number;
  style?: CSSProperties;
};

/** Wraps children in a pointer-tilted 3D plane. Falls back to a flat div under reduced motion. */
export function TiltCard({ children, className, maxTilt = 8, hoverScale = 1.015, style }: TiltCardProps) {
  const tilt = useTilt3D({ maxTilt, hoverScale });

  if (tilt.reduceMotion) {
    return <div className={className} style={style}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      style={{
        ...style,
        rotateX: tilt.rotateX,
        rotateY: tilt.rotateY,
        scale: tilt.scale,
        transformPerspective: 900,
      }}
      onMouseMove={tilt.onMouseMove}
      onMouseLeave={tilt.onMouseLeave}
    >
      {children}
    </motion.div>
  );
}
