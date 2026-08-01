"use client";

import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { classNames } from "@/lib/classNames";

export type TipTone = "ink" | "mint" | "sky" | "lemon" | "coral" | "violet";
export type TipSide = "top" | "bottom" | "left" | "right";

type TipProps = {
  /** Main tip body — keep short and action-oriented. */
  content: ReactNode;
  /** Tiny mono stamp above the body (e.g. OPS, HINT, NEW). */
  stamp?: string;
  tone?: TipTone;
  side?: TipSide;
  /** Hover open delay in ms. Focus opens immediately. */
  delay?: number;
  disabled?: boolean;
  /** Max width of the floating card. */
  maxWidth?: number;
  children: ReactNode;
};

type Pos = { top: number; left: number; side: TipSide };

const MARGIN = 10;
const VIEW_PAD = 8;

function preferSide(
  preferred: TipSide,
  trigger: DOMRect,
  tipW: number,
  tipH: number,
): TipSide {
  const space = {
    top: trigger.top,
    bottom: window.innerHeight - trigger.bottom,
    left: trigger.left,
    right: window.innerWidth - trigger.right,
  };
  const need = {
    top: tipH + MARGIN,
    bottom: tipH + MARGIN,
    left: tipW + MARGIN,
    right: tipW + MARGIN,
  };
  if (space[preferred] >= need[preferred]) return preferred;
  const order: TipSide[] = [preferred, "top", "bottom", "right", "left"];
  for (const s of order) {
    if (space[s] >= need[s] * 0.7) return s;
  }
  return preferred;
}

function place(side: TipSide, trigger: DOMRect, tipW: number, tipH: number): Pos {
  let top = 0;
  let left = 0;
  if (side === "top") {
    top = trigger.top - tipH - MARGIN;
    left = trigger.left + trigger.width / 2 - tipW / 2;
  } else if (side === "bottom") {
    top = trigger.bottom + MARGIN;
    left = trigger.left + trigger.width / 2 - tipW / 2;
  } else if (side === "left") {
    top = trigger.top + trigger.height / 2 - tipH / 2;
    left = trigger.left - tipW - MARGIN;
  } else {
    top = trigger.top + trigger.height / 2 - tipH / 2;
    left = trigger.right + MARGIN;
  }
  left = Math.min(Math.max(VIEW_PAD, left), window.innerWidth - tipW - VIEW_PAD);
  top = Math.min(Math.max(VIEW_PAD, top), window.innerHeight - tipH - VIEW_PAD);
  return { top, left, side };
}

/**
 * Neo-brutal Field Ops tooltip — thick border, offset shadow, mono stamp.
 * Wraps children and shows on hover / focus-within.
 */
export function Tip({
  content,
  stamp = "TIP",
  tone = "ink",
  side = "bottom",
  delay = 280,
  disabled = false,
  maxWidth = 240,
  children,
}: TipProps) {
  const tipId = useId();
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const show = useCallback(
    (immediate = false) => {
      if (disabled || !content) return;
      clearTimer();
      if (immediate || delay <= 0) {
        setOpen(true);
        return;
      }
      timerRef.current = setTimeout(() => setOpen(true), delay);
    },
    [content, delay, disabled],
  );

  const hide = useCallback(() => {
    clearTimer();
    setOpen(false);
  }, []);

  useEffect(() => () => clearTimer(), []);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !tipRef.current) return;
    const update = () => {
      const trigger = triggerRef.current!.getBoundingClientRect();
      const tipBox = tipRef.current!.getBoundingClientRect();
      const nextSide = preferSide(side, trigger, tipBox.width, tipBox.height);
      setPos(place(nextSide, trigger, tipBox.width, tipBox.height));
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, side, content]);

  const style: CSSProperties | undefined = pos
    ? { top: pos.top, left: pos.left, maxWidth }
    : { top: -9999, left: -9999, maxWidth, visibility: "hidden" };

  return (
    <>
      <span
        ref={triggerRef}
        className="ops-tip-anchor"
        onMouseEnter={() => show(false)}
        onMouseLeave={hide}
        onFocusCapture={() => show(true)}
        onBlurCapture={(e) => {
          const next = e.relatedTarget as Node | null;
          if (next && triggerRef.current?.contains(next)) return;
          hide();
        }}
        aria-describedby={open ? tipId : undefined}
      >
        {children}
      </span>
      {mounted &&
        open &&
        createPortal(
          <div
            ref={tipRef}
            id={tipId}
            role="tooltip"
            className={classNames(
              "ops-tip",
              `ops-tip-${tone}`,
              pos && `ops-tip-side-${pos.side}`,
              pos && "ops-tip-ready",
            )}
            style={style}
          >
            <span className="ops-tip-stamp">{stamp}</span>
            <div className="ops-tip-body">{content}</div>
            <span className="ops-tip-arrow" aria-hidden="true" />
          </div>,
          document.body,
        )}
    </>
  );
}
