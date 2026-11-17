"use client";

import { useRef, useState, type PointerEvent } from "react";

/** A touch or a mouse has to move this far before it is a drag and not a click. */
const DRAG_THRESHOLD = 8;

export type Drag = { id: string; x: number; y: number };
export type DropTarget = { slot?: string; player?: string };

/**
 * Dragging of a player chip with a mouse or a finger. A press that moves less than the threshold
 * stays a click; a real drag ends with `onDrop` and swallows the click that follows it.
 */
export function usePlayerDrag({
  disabled,
  onStart,
  onDrop,
}: {
  /** The chip of this player cannot be dragged (the lineup is locked, he is injured). */
  disabled: (id: string) => boolean;
  /** A drag has started. */
  onStart: () => void;
  /** The drag ended over a pitch slot or over a player chip (or over nothing). */
  onDrop: (id: string, target: DropTarget) => void;
}) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const press = useRef<{ id: string; x: number; y: number; active: boolean } | null>(null);
  const justDragged = useRef(false);

  function onPointerDown(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (disabled(id)) return;
    press.current = { id, x: event.clientX, y: event.clientY, active: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const current = press.current;
    if (!current) return;
    if (
      !current.active &&
      Math.hypot(event.clientX - current.x, event.clientY - current.y) > DRAG_THRESHOLD
    ) {
      current.active = true;
      onStart();
    }
    if (current.active) setDrag({ id: current.id, x: event.clientX, y: event.clientY });
  }

  function onPointerUp(event: PointerEvent<HTMLButtonElement>) {
    const current = press.current;
    press.current = null;
    if (!current?.active) return;
    justDragged.current = true;
    setTimeout(() => (justDragged.current = false), 0);
    setDrag(null);
    const under = document.elementFromPoint(event.clientX, event.clientY);
    const slotEl = under?.closest<HTMLElement>("[data-slot]");
    const chipEl = under?.closest<HTMLElement>("[data-chip-player]");
    onDrop(current.id, { slot: slotEl?.dataset.slot, player: chipEl?.dataset.chipPlayer });
  }

  /** True once after a drag: the click that ends the drag must not select anybody. */
  function consumeClick(): boolean {
    if (!justDragged.current) return false;
    justDragged.current = false;
    return true;
  }

  return { drag, onPointerDown, onPointerMove, onPointerUp, consumeClick };
}
