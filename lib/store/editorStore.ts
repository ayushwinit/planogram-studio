import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { nanoid } from "nanoid";
import type {
  Arrangement,
  Planogram,
  RowSlot,
  Selection,
  Shelf,
  ShelfRow,
  PlacedProduct,
} from "../types";

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

interface HydrateInput {
  planogram: Planogram;
  planogramId: string;
  tenantSlug: string;
  planogramSlug: string;
  customerName: string;
  lastSavedAt: string;
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
  setHoverDropTarget: (t: { shelfId: string; rowId: RowSlot } | null) => void;

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

    setHoverDropTarget: (t) =>
      set((s) => {
        s.hoverDropTarget = t;
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
        s.selection = { kind: "placement", id: instanceId };
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
        if (s.selection.kind === "placement" && s.selection.id === id) {
          s.selection = { kind: "none" };
        }
      }),

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
