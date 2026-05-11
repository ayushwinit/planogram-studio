import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { nanoid } from "nanoid";
import type {
  Arrangement,
  Planogram,
  PlacementSnapshot,
  RowSlot,
  Selection,
  Shelf,
  ShelfRow,
  PlacedProduct,
} from "../types";
import { arrangementMetrics } from "../arrangement";
import { useCatalogStore, toEditorProduct } from "./catalogStore";

// Canvas size is dynamic and derived from the shelf bounding box at render time
// (see `computeCanvasSizeMm`). Defaults below only seed the persisted Planogram
// model and exports' aspect ratios.
const DEFAULT_CANVAS_W = 1200;
const DEFAULT_CANVAS_H = 800;

const SHELF_DEFAULTS = {
  widthMm: 800,
  borderWidthPx: 3,
  borderColor: "#475569",
  backgroundColor: "#f8fafc",
  topAreaMm: 0,
};

const INNER_SHELF_DEFAULTS = {
  heightMm: 120,
  borderWidthPx: 2,
  borderColor: "#94a3b8",
  backgroundColor: "#ffffff",
};

const MAX_INNER_SHELVES = 10;

// Shelves are sized in real-world mm, so a freshly created 800mm-wide unit at
// 1:1 (100%) overflows the typical viewport. 50% lets the whole shelf fit on
// screen without the user having to zoom out manually.
const DEFAULT_ZOOM = 0.5;

function makeInnerShelf(index: number, outerWidthMm: number, patch?: Partial<ShelfRow>): ShelfRow {
  return {
    id: nanoid(),
    index,
    xMm: 0,
    widthMm: outerWidthMm,
    heightMm: INNER_SHELF_DEFAULTS.heightMm,
    borderWidthPx: INNER_SHELF_DEFAULTS.borderWidthPx,
    borderColor: INNER_SHELF_DEFAULTS.borderColor,
    backgroundColor: INNER_SHELF_DEFAULTS.backgroundColor,
    label: `Shelf ${index + 1}`,
    ...patch,
  };
}

function makeInitialPlanogram(): Planogram {
  const now = new Date().toISOString();
  return {
    id: nanoid(),
    name: "Untitled Planogram",
    createdAt: now,
    updatedAt: now,
    canvasWidthMm: DEFAULT_CANVAS_W,
    canvasHeightMm: DEFAULT_CANVAS_H,
    shelves: [],
    placements: [],
    meta: { version: 1 },
  };
}

/** Bump updatedAt + flip the dirty flag in one go. Called from every mutating
 *  setter so the cloud-Save button (and the gating of image/PDF download)
 *  knows when the in-memory state has diverged from what's stored. */
function markEdit(s: { planogram: Planogram; dirtySinceSave: boolean }) {
  s.planogram.updatedAt = new Date().toISOString();
  s.dirtySinceSave = true;
}

/** Horizontal footprint of a placement in mm, factoring arrangement + scaleX.
 *  Used by mirror-replication to flip the LEFT edge correctly: the new x =
 *  rowWidth - oldX - footprint. Falls back to 0 if the product is missing. */
function footprintWidthMm(p: Pick<PlacedProduct, "productId" | "arrangement" | "scaleX" | "scale">): number {
  const raw = useCatalogStore.getState().products.find((x) => x.productId === p.productId);
  if (!raw) return 0;
  const product = toEditorProduct(raw);
  const metrics = arrangementMetrics(product, p.arrangement);
  const sx = p.scaleX ?? p.scale ?? 1;
  return metrics.totalWidthMm * sx;
}

interface HydrateInput {
  planogram: Planogram;
  planogramId: string;
  tenantSlug: string;
  planogramSlug: string;
  customerName: string;
  lastSavedAt: string;
}

/** Right-click context menu anchor + targets. The menu component watches this
 *  field and renders an absolutely-positioned popup at (x, y). */
export interface ContextMenuState {
  /** Anchor coords in viewport (clientX, clientY) — the menu is portaled to
   *  the document body and positioned via fixed coords. */
  x: number;
  y: number;
  /** Placements the menu acts on. For single right-click this is `[id]`. For
   *  right-click on an already multi-selected placement it's the full set. */
  placementIds: string[];
}

interface ClipboardState {
  entries: PlacementSnapshot[];
  capturedAt: string;
}

interface EditorState {
  planogram: Planogram;
  /** Set when the editor is bound to a server-side row. */
  planogramId: string | null;
  tenantSlug: string | null;
  planogramSlug: string | null;
  customerName: string;
  /** True when there are unsaved local edits since the last cloud save. */
  dirtySinceSave: boolean;
  lastSavedAt: string | null;

  selection: Selection;
  /** Live marquee rectangle in viewport (screen) pixel coords. Rendered by
   *  the Canvas overlay; cleared on pointerup. */
  marquee: { startX: number; startY: number; curX: number; curY: number } | null;
  /** Persistent clipboard. Survives selection changes so a single copy can
   *  be pasted many times. */
  clipboard: ClipboardState | null;
  contextMenu: ContextMenuState | null;
  zoom: number;
  panX: number;
  panY: number;
  hoverDropTarget: { shelfId: string; rowId: RowSlot } | null;

  hydrate: (input: HydrateInput) => void;
  markSaved: (savedAt: string, planogramSlug?: string) => void;
  setCustomerName: (s: string) => void;

  setName: (name: string) => void;
  setCanvasSize: (w: number, h: number) => void;
  setMeta: (patch: Partial<Planogram["meta"]>) => void;

  setZoom: (z: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  /** Apply a new zoom while keeping the viewport point (anchorPxX, anchorPxY) under the same world coord. */
  zoomAt: (newZoom: number, anchorPxX: number, anchorPxY: number) => void;
  panBy: (dxPx: number, dyPx: number) => void;
  resetView: () => void;

  select: (s: Selection) => void;
  /** Replace placement selection with the given ids. Empty array → clear. */
  selectPlacements: (ids: string[]) => void;
  /** Add or remove a single placement from the current placement selection
   *  (additive shift-click behaviour). Switches to placement-kind selection
   *  if it wasn't one already. */
  togglePlacementSelection: (id: string) => void;
  setHoverDropTarget: (t: { shelfId: string; rowId: RowSlot } | null) => void;
  setMarquee: (m: EditorState["marquee"]) => void;
  openContextMenu: (m: ContextMenuState) => void;
  closeContextMenu: () => void;

  /** Create the single outer shelf with `innerCount` horizontal inner shelves.
   *  No-op if an outer shelf already exists (use `addInnerShelf` to grow it). */
  createShelfUnit: (innerCount: number) => string | null;
  updateShelf: (id: string, patch: Partial<Shelf>) => void;
  setShelfTotalHeight: (id: string, totalHeightMm: number) => void;
  removeShelf: (id: string) => void;

  /** Append one inner shelf to the existing outer shelf. */
  addInnerShelf: (shelfId: string) => string | null;
  updateRow: (shelfId: string, rowId: string, patch: Partial<ShelfRow>) => void;
  moveRow: (shelfId: string, rowId: string, direction: "up" | "down") => void;
  removeRow: (shelfId: string, rowId: string) => void;

  addPlacement: (input: {
    productId: string;
    shelfId: string;
    rowId: RowSlot;
    xMm: number;
    yMm: number;
    arrangement: Arrangement;
    rotationDeg?: 0 | 90 | 180 | 270;
  }) => string;
  updatePlacement: (id: string, patch: Partial<PlacedProduct>) => void;
  movePlacement: (
    id: string,
    target: { shelfId: string; rowId: RowSlot; xMm: number; yMm: number }
  ) => void;
  removePlacement: (id: string) => void;
  /** Bulk delete — used by multi-select Delete. */
  removePlacements: (ids: string[]) => void;

  /** Snapshot the currently selected placements into the clipboard. Returns
   *  the number of entries captured (0 if no placement selection). */
  copySelectionToClipboard: () => number;
  /** Clear the clipboard. */
  clearClipboard: () => void;
  /** Paste clipboard entries into (shelfId, rowId) anchored at (xMm, yMm).
   *  Multiple entries preserve their original relative offsets. Newly created
   *  placements become the selection. Returns created instanceIds. */
  pasteClipboardTo: (target: {
    shelfId: string;
    rowId: RowSlot;
    xMm: number;
    yMm: number;
  }) => string[];
  /** Duplicate the current placement selection in place with an offset (mm).
   *  Equivalent to copy + paste at +offset, without touching the clipboard. */
  duplicateSelection: (offsetMm?: { dxMm: number; dyMm: number }) => string[];
  /** Replicate all placements from one inner shelf (row) onto one or more
   *  other inner shelves of the same outer shelf. */
  replicateRowContents: (input: {
    srcShelfId: string;
    srcRowId: RowSlot;
    dstRowIds: string[];
    mode: "exact" | "mirror" | "fillEmpty";
    /** If true, existing placements in dst rows are removed first (only
     *  applies when mode !== "fillEmpty"). */
    replaceExisting: boolean;
  }) => number;

  reset: () => void;
}

export const useEditorStore = create<EditorState>()(
  immer((set, get) => ({
    planogram: makeInitialPlanogram(),
    planogramId: null,
    tenantSlug: null,
    planogramSlug: null,
    customerName: "",
    dirtySinceSave: false,
    lastSavedAt: null,

    selection: { kind: "none" },
    marquee: null,
    clipboard: null,
    contextMenu: null,
    zoom: DEFAULT_ZOOM,
    panX: 80,
    panY: 80,
    hoverDropTarget: null,

    hydrate: (input) =>
      set((s) => {
        s.planogram = input.planogram;
        s.planogramId = input.planogramId;
        s.tenantSlug = input.tenantSlug;
        s.planogramSlug = input.planogramSlug;
        s.customerName = input.customerName;
        s.lastSavedAt = input.lastSavedAt;
        s.dirtySinceSave = false;
        s.selection = { kind: "none" };
        s.zoom = DEFAULT_ZOOM;
        s.panX = 80;
        s.panY = 80;
      }),

    markSaved: (savedAt, planogramSlug) =>
      set((s) => {
        s.lastSavedAt = savedAt;
        s.dirtySinceSave = false;
        if (planogramSlug && planogramSlug !== s.planogramSlug) {
          s.planogramSlug = planogramSlug;
        }
      }),

    setCustomerName: (v) =>
      set((s) => {
        if (s.customerName === v) return;
        s.customerName = v;
        s.dirtySinceSave = true;
      }),

    setName: (name) =>
      set((s) => {
        s.planogram.name = name;
        markEdit(s);
      }),

    setCanvasSize: (w, h) =>
      set((s) => {
        s.planogram.canvasWidthMm = w;
        s.planogram.canvasHeightMm = h;
        markEdit(s);
      }),

    setMeta: (patch) =>
      set((s) => {
        s.planogram.meta = { ...s.planogram.meta, ...patch };
        markEdit(s);
      }),

    setZoom: (z) =>
      set((s) => {
        s.zoom = Math.min(4, Math.max(0.1, z));
      }),
    zoomIn: () =>
      set((s) => {
        s.zoom = Math.min(4, Math.round((s.zoom + 0.1) * 100) / 100);
      }),
    zoomOut: () =>
      set((s) => {
        s.zoom = Math.max(0.1, Math.round((s.zoom - 0.1) * 100) / 100);
      }),
    resetZoom: () =>
      set((s) => {
        s.zoom = 1;
      }),
    zoomAt: (newZoom, ax, ay) =>
      set((s) => {
        const z = Math.min(4, Math.max(0.1, newZoom));
        if (z === s.zoom) return;
        const ratio = z / s.zoom;
        s.panX = ax - (ax - s.panX) * ratio;
        s.panY = ay - (ay - s.panY) * ratio;
        s.zoom = z;
      }),
    panBy: (dxPx, dyPx) =>
      set((s) => {
        s.panX += dxPx;
        s.panY += dyPx;
      }),
    resetView: () =>
      set((s) => {
        s.zoom = DEFAULT_ZOOM;
        s.panX = 80;
        s.panY = 80;
      }),

    select: (sel) =>
      set((s) => {
        s.selection = sel;
      }),

    selectPlacements: (ids) =>
      set((s) => {
        if (ids.length === 0) {
          s.selection = { kind: "none" };
        } else {
          s.selection = { kind: "placement", ids: [...ids] };
        }
      }),

    togglePlacementSelection: (id) =>
      set((s) => {
        if (s.selection.kind !== "placement") {
          s.selection = { kind: "placement", ids: [id] };
          return;
        }
        const idSet = new Set(s.selection.ids);
        if (idSet.has(id)) idSet.delete(id);
        else idSet.add(id);
        if (idSet.size === 0) {
          s.selection = { kind: "none" };
        } else {
          s.selection = { kind: "placement", ids: [...idSet] };
        }
      }),

    setHoverDropTarget: (t) =>
      set((s) => {
        s.hoverDropTarget = t;
      }),

    setMarquee: (m) =>
      set((s) => {
        s.marquee = m;
      }),

    openContextMenu: (m) =>
      set((s) => {
        s.contextMenu = m;
      }),

    closeContextMenu: () =>
      set((s) => {
        s.contextMenu = null;
      }),

    createShelfUnit: (innerCount) => {
      // Single-outer-shelf invariant: bail if one already exists.
      if (get().planogram.shelves.length > 0) return null;
      const safeCount = Math.max(1, Math.min(MAX_INNER_SHELVES, Math.floor(innerCount)));
      const id = nanoid();
      set((s) => {
        const widthMm = SHELF_DEFAULTS.widthMm;
        const inner: ShelfRow[] = Array.from({ length: safeCount }, (_, i) =>
          makeInnerShelf(i, widthMm)
        );
        const outer: Shelf = {
          id,
          index: 0,
          xMm: 20,
          yMm: 20,
          widthMm,
          topAreaMm: SHELF_DEFAULTS.topAreaMm,
          rows: inner,
          borderWidthPx: SHELF_DEFAULTS.borderWidthPx,
          borderColor: SHELF_DEFAULTS.borderColor,
          backgroundColor: SHELF_DEFAULTS.backgroundColor,
        };
        s.planogram.shelves = [outer];
        markEdit(s);
        s.selection = { kind: "shelf", id };
      });
      return id;
    },

    updateShelf: (id, patch) =>
      set((s) => {
        const shelf = s.planogram.shelves.find((sh) => sh.id === id);
        if (!shelf) return;
        // If the outer width changes, scale every inner shelf horizontally so
        // they keep filling the unit (and full-width rows stay flush to the
        // edges). Done before Object.assign so we read the old width.
        if (patch.widthMm !== undefined && patch.widthMm !== shelf.widthMm && shelf.widthMm > 0) {
          const ratio = patch.widthMm / shelf.widthMm;
          shelf.rows.forEach((row) => {
            row.xMm = row.xMm * ratio;
            row.widthMm = Math.max(1, row.widthMm * ratio);
          });
        }
        Object.assign(shelf, patch);
        markEdit(s);
      }),

    setShelfTotalHeight: (id, totalHeightMm) =>
      set((s) => {
        const shelf = s.planogram.shelves.find((sh) => sh.id === id);
        if (!shelf) return;
        const target = Math.max(20, totalHeightMm);
        const currentTotal = shelf.topAreaMm + shelf.rows.reduce((a, r) => a + r.heightMm, 0);
        if (currentTotal <= 0) return;
        const factor = target / currentTotal;
        shelf.topAreaMm = Math.round(shelf.topAreaMm * factor);
        shelf.rows.forEach((r) => {
          r.heightMm = Math.max(10, Math.round(r.heightMm * factor));
        });
        markEdit(s);
      }),

    removeShelf: (id) =>
      set((s) => {
        s.planogram.shelves = s.planogram.shelves.filter((sh) => sh.id !== id);
        s.planogram.placements = s.planogram.placements.filter((p) => p.shelfId !== id);
        markEdit(s);
        if (s.selection.kind === "shelf" && s.selection.id === id) {
          s.selection = { kind: "none" };
        }
      }),

    addInnerShelf: (shelfId) => {
      const shelf = get().planogram.shelves.find((sh) => sh.id === shelfId);
      if (!shelf) return null;
      if (shelf.rows.length >= MAX_INNER_SHELVES) return null;
      const rowId = nanoid();
      set((s) => {
        const sh = s.planogram.shelves.find((x) => x.id === shelfId);
        if (!sh) return;
        sh.rows.push(makeInnerShelf(sh.rows.length, sh.widthMm, { id: rowId }));
        markEdit(s);
      });
      return rowId;
    },

    moveRow: (shelfId, rowId, direction) =>
      set((s) => {
        const shelf = s.planogram.shelves.find((sh) => sh.id === shelfId);
        if (!shelf) return;
        const idx = shelf.rows.findIndex((r) => r.id === rowId);
        if (idx < 0) return;
        const newIdx = direction === "up" ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= shelf.rows.length) return;
        const [removed] = shelf.rows.splice(idx, 1);
        shelf.rows.splice(newIdx, 0, removed);
        shelf.rows.forEach((r, i) => (r.index = i));
        markEdit(s);
      }),

    updateRow: (shelfId, rowId, patch) =>
      set((s) => {
        const shelf = s.planogram.shelves.find((sh) => sh.id === shelfId);
        if (!shelf) return;
        const row = shelf.rows.find((r) => r.id === rowId);
        if (row) {
          Object.assign(row, patch);
          markEdit(s);
        }
      }),

    removeRow: (shelfId, rowId) =>
      set((s) => {
        const shelf = s.planogram.shelves.find((sh) => sh.id === shelfId);
        if (!shelf) return;
        shelf.rows = shelf.rows.filter((r) => r.id !== rowId);
        shelf.rows.forEach((r, idx) => (r.index = idx));
        s.planogram.placements = s.planogram.placements.filter(
          (p) => !(p.shelfId === shelfId && p.rowId === rowId)
        );
        markEdit(s);
      }),

    addPlacement: ({ productId, shelfId, rowId, xMm, yMm, arrangement, rotationDeg = 0 }) => {
      const instanceId = nanoid();
      set((s) => {
        s.planogram.placements.push({
          instanceId,
          productId,
          shelfId,
          rowId,
          xMm,
          yMm,
          arrangement,
          rotationDeg,
        });
        markEdit(s);
        s.selection = { kind: "placement", ids: [instanceId] };
      });
      return instanceId;
    },

    updatePlacement: (id, patch) =>
      set((s) => {
        const p = s.planogram.placements.find((pp) => pp.instanceId === id);
        if (p) {
          Object.assign(p, patch);
          markEdit(s);
        }
      }),

    movePlacement: (id, target) =>
      set((s) => {
        const p = s.planogram.placements.find((pp) => pp.instanceId === id);
        if (p) {
          p.shelfId = target.shelfId;
          p.rowId = target.rowId;
          p.xMm = target.xMm;
          p.yMm = target.yMm;
          markEdit(s);
        }
      }),

    removePlacement: (id) =>
      set((s) => {
        s.planogram.placements = s.planogram.placements.filter((p) => p.instanceId !== id);
        markEdit(s);
        if (s.selection.kind === "placement") {
          const next = s.selection.ids.filter((i) => i !== id);
          s.selection = next.length === 0 ? { kind: "none" } : { kind: "placement", ids: next };
        }
      }),

    removePlacements: (ids) =>
      set((s) => {
        if (ids.length === 0) return;
        const ban = new Set(ids);
        s.planogram.placements = s.planogram.placements.filter((p) => !ban.has(p.instanceId));
        markEdit(s);
        if (s.selection.kind === "placement") {
          const next = s.selection.ids.filter((i) => !ban.has(i));
          s.selection = next.length === 0 ? { kind: "none" } : { kind: "placement", ids: next };
        }
      }),

    copySelectionToClipboard: () => {
      const state = get();
      if (state.selection.kind !== "placement" || state.selection.ids.length === 0) return 0;
      const idSet = new Set(state.selection.ids);
      const selected = state.planogram.placements.filter((p) => idSet.has(p.instanceId));
      if (selected.length === 0) return 0;
      // Bounding box of selected placements in (xMm, yMm) row-local space.
      // yMm is measured from the row floor going up, so "bottom" = min(yMm).
      // When the selection spans multiple rows we ignore that dimension —
      // paste squashes the relative y positions into the target row anyway.
      const minX = Math.min(...selected.map((p) => p.xMm));
      const minY = Math.min(...selected.map((p) => p.yMm));
      const shelfById = new Map(state.planogram.shelves.map((sh) => [sh.id, sh] as const));
      const entries: PlacementSnapshot[] = selected.map((p) => {
        const shelf = shelfById.get(p.shelfId);
        const row = shelf?.rows.find((r) => r.id === p.rowId);
        const rowWidthMm =
          p.rowId === "top" ? shelf?.widthMm ?? 0 : row?.widthMm ?? shelf?.widthMm ?? 0;
        return {
          productId: p.productId,
          arrangement: p.arrangement,
          rotationDeg: p.rotationDeg,
          scaleX: p.scaleX,
          scaleY: p.scaleY,
          scale: p.scale,
          notes: p.notes,
          relXMm: p.xMm - minX,
          relYMm: p.yMm - minY,
          srcRowWidthMm: rowWidthMm,
        };
      });
      set((s) => {
        s.clipboard = { entries, capturedAt: new Date().toISOString() };
      });
      return entries.length;
    },

    clearClipboard: () =>
      set((s) => {
        s.clipboard = null;
      }),

    pasteClipboardTo: (target) => {
      const state = get();
      const clip = state.clipboard;
      if (!clip || clip.entries.length === 0) return [];
      const newIds: string[] = [];
      set((s) => {
        for (const entry of clip.entries) {
          const instanceId = nanoid();
          newIds.push(instanceId);
          s.planogram.placements.push({
            instanceId,
            productId: entry.productId,
            shelfId: target.shelfId,
            rowId: target.rowId,
            xMm: Math.max(0, target.xMm + entry.relXMm),
            yMm: Math.max(0, target.yMm + entry.relYMm),
            arrangement: entry.arrangement,
            rotationDeg: entry.rotationDeg,
            scaleX: entry.scaleX,
            scaleY: entry.scaleY,
            scale: entry.scale,
            notes: entry.notes,
          });
        }
        markEdit(s);
        s.selection = { kind: "placement", ids: newIds };
      });
      return newIds;
    },

    duplicateSelection: (offset) => {
      const state = get();
      if (state.selection.kind !== "placement" || state.selection.ids.length === 0) return [];
      const idSet = new Set(state.selection.ids);
      const selected = state.planogram.placements.filter((p) => idSet.has(p.instanceId));
      if (selected.length === 0) return [];
      const dxMm = offset?.dxMm ?? 20;
      const dyMm = offset?.dyMm ?? 0;
      const newIds: string[] = [];
      set((s) => {
        for (const src of selected) {
          const instanceId = nanoid();
          newIds.push(instanceId);
          s.planogram.placements.push({
            ...src,
            instanceId,
            xMm: Math.max(0, src.xMm + dxMm),
            yMm: Math.max(0, src.yMm + dyMm),
          });
        }
        markEdit(s);
        s.selection = { kind: "placement", ids: newIds };
      });
      return newIds;
    },

    replicateRowContents: ({ srcShelfId, srcRowId, dstRowIds, mode, replaceExisting }) => {
      const state = get();
      const shelf = state.planogram.shelves.find((sh) => sh.id === srcShelfId);
      if (!shelf) return 0;
      const srcWidthMm =
        srcRowId === "top"
          ? shelf.widthMm
          : shelf.rows.find((r) => r.id === srcRowId)?.widthMm ?? shelf.widthMm;
      const srcPlacements = state.planogram.placements.filter(
        (p) => p.shelfId === srcShelfId && p.rowId === srcRowId
      );
      if (srcPlacements.length === 0 || dstRowIds.length === 0) return 0;

      let created = 0;
      set((s) => {
        for (const dstRowId of dstRowIds) {
          if (dstRowId === srcRowId) continue;
          const dstRow = shelf.rows.find((r) => r.id === dstRowId);
          const dstWidthMm =
            dstRowId === "top" ? shelf.widthMm : dstRow?.widthMm ?? shelf.widthMm;
          const ratio = srcWidthMm > 0 ? dstWidthMm / srcWidthMm : 1;

          const existing = s.planogram.placements.filter(
            (p) => p.shelfId === srcShelfId && p.rowId === dstRowId
          );
          if (mode !== "fillEmpty" && replaceExisting && existing.length > 0) {
            s.planogram.placements = s.planogram.placements.filter(
              (p) => !(p.shelfId === srcShelfId && p.rowId === dstRowId)
            );
          } else if (mode === "fillEmpty" && existing.length > 0) {
            // Skip rows that already have anything.
            continue;
          }

          for (const src of srcPlacements) {
            const scaledX = src.xMm * ratio;
            const newX =
              mode === "mirror"
                ? Math.max(0, dstWidthMm - scaledX - footprintWidthMm(src) * ratio)
                : scaledX;
            s.planogram.placements.push({
              ...src,
              instanceId: nanoid(),
              shelfId: srcShelfId,
              rowId: dstRowId,
              xMm: Math.max(0, newX),
            });
            created += 1;
          }
        }
        markEdit(s);
      });
      return created;
    },

    reset: () =>
      set((s) => {
        // Wipe canvas content but keep the binding to the saved row, since
        // "Clear" is intended to empty the planogram in-place — the user can
        // then Save to persist the cleared state, or navigate away to discard.
        s.planogram = {
          ...makeInitialPlanogram(),
          name: s.planogram.name,
        };
        s.selection = { kind: "none" };
        s.zoom = DEFAULT_ZOOM;
        s.panX = 80;
        s.panY = 80;
        s.dirtySinceSave = true;
      }),
  }))
);

export const MAX_INNER_SHELVES_LIMIT = MAX_INNER_SHELVES;
