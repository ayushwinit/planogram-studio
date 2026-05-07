"use client";
import * as React from "react";
import { LayoutGrid } from "lucide-react";
import { useEditorStore } from "@/lib/store/editorStore";
import { Shelf } from "./Shelf";

const ZOOM_PER_WHEEL_TICK = 0.0015;
const GRID_SIZE_BASE_PX = 24;

/**
 * Infinite, fixed-viewport canvas — n8n / React Flow style.
 *  • Wheel  -> zoom anchored at cursor
 *  • Drag empty space -> pan
 *  • Shelves live in world (mm) space; the world wrapper is translated, not scaled.
 *
 * We deliberately avoid CSS `scale()` because dnd-kit, the shelf pointer-drag
 * code, and the drop-position math all assume zoom is baked into the rendered
 * px values via `mmToPx(x, zoom)`. CSS scale would silently break every one of
 * those calculations.
 */
export function Canvas() {
  const planogram = useEditorStore((s) => s.planogram);
  const zoom = useEditorStore((s) => s.zoom);
  const panX = useEditorStore((s) => s.panX);
  const panY = useEditorStore((s) => s.panY);
  const select = useEditorStore((s) => s.select);
  const zoomAt = useEditorStore((s) => s.zoomAt);
  const panBy = useEditorStore((s) => s.panBy);

  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const [isPanning, setIsPanning] = React.useState(false);

  // Zoom on wheel, anchored at cursor position relative to viewport.
  // (Page scroll is suppressed by the non-passive native listener below.)
  const handleWheel = React.useCallback(
    (e: React.WheelEvent) => {
      const vp = viewportRef.current;
      if (!vp) return;
      e.stopPropagation();
      const rect = vp.getBoundingClientRect();
      const ax = e.clientX - rect.left;
      const ay = e.clientY - rect.top;
      // Multiplicative step keeps zoom feel consistent across magnitudes.
      const factor = Math.exp(-e.deltaY * ZOOM_PER_WHEEL_TICK);
      zoomAt(zoom * factor, ax, ay);
    },
    [zoom, zoomAt],
  );

  // Wheel events from the browser default to passive listeners on React 19,
  // which prevents preventDefault() from working. Attach a non-passive wheel
  // listener manually so the browser doesn't fight us for scroll.
  React.useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    function onNativeWheel(e: WheelEvent) {
      e.preventDefault();
    }
    vp.addEventListener("wheel", onNativeWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onNativeWheel);
  }, []);

  // Click/drag on empty space -> pan. We only start a pan when the pointer
  // came down on the viewport background itself — clicks on shelves bubble up
  // separately and run their own selection/drag handlers.
  function handlePointerDown(e: React.PointerEvent) {
    if (e.button !== 0 && e.button !== 1) return;
    if (e.target !== e.currentTarget) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    let lastX = startX;
    let lastY = startY;
    let didDrag = false;
    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - lastX;
      const dy = ev.clientY - lastY;
      if (!didDrag && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 3) return;
      if (!didDrag) setIsPanning(true);
      didDrag = true;
      lastX = ev.clientX;
      lastY = ev.clientY;
      panBy(dx, dy);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setIsPanning(false);
      if (didDrag) select({ kind: "none" });
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div
      ref={viewportRef}
      className={`relative h-full w-full overflow-hidden select-none ${
        isPanning ? "cursor-grabbing" : "cursor-grab"
      }`}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        select({ kind: "none" });
      }}
      style={{
        backgroundColor: "#f1f5f9",
        // Dotted grid that pans and zooms with the world.
        backgroundImage:
          "radial-gradient(circle, rgba(148,163,184,0.6) 1px, transparent 1px)",
        backgroundSize: `${GRID_SIZE_BASE_PX * zoom}px ${GRID_SIZE_BASE_PX * zoom}px`,
        backgroundPosition: `${panX}px ${panY}px`,
      }}
    >
      {/* The world wrapper. Shelves are positioned absolutely inside via
          mmToPx(x, zoom) — zoom is encoded in the rendered px, NOT in a CSS
          scale, so dnd-kit and pointer math keep working. We only translate.
          The wrapper itself has zero size (its only children are absolute), so
          clicks in the gaps between shelves naturally hit the viewport and
          trigger the pan handler. */}
      <div
        id="planogram-stage"
        className="absolute top-0 left-0"
        style={{
          transform: `translate(${panX}px, ${panY}px)`,
          transformOrigin: "0 0",
        }}
      >
        {planogram.shelves.map((shelf) => (
          <Shelf key={shelf.id} shelf={shelf} />
        ))}
      </div>

      {planogram.shelves.length === 0 ? (
        <div className="absolute inset-0 grid place-items-center text-slate-400 text-sm pointer-events-none">
          <div className="flex flex-col items-center gap-2">
            <div className="h-12 w-12 rounded-full bg-slate-100 grid place-items-center">
              <LayoutGrid className="h-6 w-6 text-slate-400" />
            </div>
            <div className="font-medium text-slate-600">Empty canvas</div>
            <div className="text-xs text-slate-400">
              Click <span className="font-semibold text-indigo-600">Add Shelf</span> above and pick how many shelves the unit has. Scroll to zoom, drag to pan.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
