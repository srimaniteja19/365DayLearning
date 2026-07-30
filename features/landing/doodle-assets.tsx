"use client";

import { motion, useReducedMotion } from "motion/react";
import { classNames } from "@/lib/classNames";

type DoodleProps = { className?: string };

/** Hand-drawn squiggle underline. Draws itself in once scrolled into view. */
export function DoodleUnderline({ className }: DoodleProps) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.svg
      className={classNames("doodle-underline", className)}
      width="140"
      height="14"
      viewBox="0 0 140 14"
      fill="none"
      aria-hidden="true"
      initial={reduceMotion ? undefined : { pathLength: 0, opacity: 0 }}
      whileInView={reduceMotion ? undefined : { pathLength: 1, opacity: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <path
        d="M2 9.5C22 3 44 2 64 6.5C84 11 104 4 138 7"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </motion.svg>
  );
}

/** Small hand-drawn arrow. Points right by default, or down. */
export function DoodleArrow({
  className,
  direction = "right",
}: DoodleProps & { direction?: "right" | "down" }) {
  const rotate = direction === "down" ? 90 : 0;
  return (
    <svg
      className={classNames("doodle-arrow", className)}
      width="34"
      height="20"
      viewBox="0 0 34 20"
      fill="none"
      aria-hidden="true"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <path d="M2 11C10 8 19 8 27 10.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M20 4.5C23 7 26 9 28.5 11C26 12.5 23.5 15 21.5 17.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Four-point hand-drawn star, used as a decorative accent. */
export function DoodleStar({ className }: DoodleProps) {
  return (
    <svg className={classNames("doodle-star", className)} width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path
        d="M11 1.5C11.5 6 12.5 9 20.5 11C12.5 13 11.5 16 11 20.5C10.5 16 9.5 13 1.5 11C9.5 9 10.5 6 11 1.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Small hand-drawn bullet mark, replaces a plain list dot. */
export function DoodleBullet({ className }: DoodleProps) {
  return (
    <svg className={classNames("doodle-bullet", className)} width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M3 7C3 4.5 5 2.5 7.2 3C9.5 3.5 11 5.5 10.5 7.8C10 10 7.8 11.3 5.5 10.8C3.3 10.3 2 8.5 3 7Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

/** Hand-drawn circled number, used for the how-it-works step counters. */
export function DoodleCircledNumber({ n, className }: DoodleProps & { n: string | number }) {
  return (
    <span className={classNames("doodle-circled-number", className)} aria-hidden="true">
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
        <path
          d="M20 2.5C29.5 2 37.5 8.5 37.5 19.5C37.5 30 29.5 37 20 37.2C10.5 37.4 2.5 30.5 2.5 20C2.5 9.5 10 3 20 2.5Z"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
      <span className="doodle-circled-number-val">{n}</span>
    </span>
  );
}
