"use client";

import { useCallback, useRef, type MouseEvent } from "react";
import { useReducedMotion, useSpring } from "motion/react";

/**
 * Pointer-driven tilt. Values are transform-only (rotateX/rotateY/scale) so the
 * browser can composite the animation without touching layout or paint.
 */
export function useTilt3D({ maxTilt = 10, hoverScale = 1.02 } = {}) {
  const reduceMotion = useReducedMotion();
  const rotateX = useSpring(0, { stiffness: 220, damping: 20, mass: 0.6 });
  const rotateY = useSpring(0, { stiffness: 220, damping: 20, mass: 0.6 });
  const scale = useSpring(1, { stiffness: 220, damping: 24 });

  const onMouseMove = useCallback(
    (e: MouseEvent<HTMLElement>) => {
      if (reduceMotion) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      rotateY.set(px * maxTilt * 2);
      rotateX.set(py * -maxTilt * 2);
      scale.set(hoverScale);
    },
    [reduceMotion, maxTilt, hoverScale, rotateX, rotateY, scale],
  );

  const onMouseLeave = useCallback(() => {
    rotateX.set(0);
    rotateY.set(0);
    scale.set(1);
  }, [rotateX, rotateY, scale]);

  return { rotateX, rotateY, scale, onMouseMove, onMouseLeave, reduceMotion };
}

/**
 * Hero-scale interaction: board tilt + a slower, wider parallax drift for the
 * decorative background mesh. Tracked from one pointer source so both react
 * to the same cursor position without fighting each other.
 */
export function useHeroTilt() {
  const reduceMotion = useReducedMotion();
  const rotateX = useSpring(0, { stiffness: 180, damping: 22, mass: 0.7 });
  const rotateY = useSpring(0, { stiffness: 180, damping: 22, mass: 0.7 });
  const meshX = useSpring(0, { stiffness: 110, damping: 24 });
  const meshY = useSpring(0, { stiffness: 110, damping: 24 });
  const frame = useRef(0);

  const onMouseMove = useCallback(
    (e: MouseEvent<HTMLElement>) => {
      if (reduceMotion) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        rotateY.set(px * 20);
        rotateX.set(py * -16);
        meshX.set(px * -16);
        meshY.set(py * -12);
      });
    },
    [reduceMotion, rotateX, rotateY, meshX, meshY],
  );

  const onMouseLeave = useCallback(() => {
    rotateX.set(0);
    rotateY.set(0);
    meshX.set(0);
    meshY.set(0);
  }, [rotateX, rotateY, meshX, meshY]);

  return { rotateX, rotateY, meshX, meshY, onMouseMove, onMouseLeave, reduceMotion };
}
