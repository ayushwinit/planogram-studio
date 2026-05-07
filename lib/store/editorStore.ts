import { create } from "zustand";
import { persist } from "zustand/middleware";
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

const DEFAULT_CANVAS_W = 1200;
const DEFAULT_CANVAS_H = 800;

const SHELF_DEFAULTS = {
  widthMm: 800,
  borderWidthPx: 2,
  borderColor: "#475569",
  backgroundColor: "#f8fafc",
  topAreaMm: 0,
};

const ROW_DEFAULTS = {
  heightMm: 220,
  borderWidthPx: 2,
  borderColor: "#94a3b8",
  backgroundColor: "#ffffff",
};

function makeRow(index: number, shelfWidthMm: number, patch?: Partial<ShelfRow>): ShelfRow {
  return {
    id: nanoid(),
    index,
    xMm: 0,
    widthMm: shelfWidthMm,
    heightMm: ROW_DEFAULTS.heightMm,
    borderWidthPx: ROW_DEFAULTS.borderWidthPx,
    borderColor: ROW_DEFAULTS.borderColor,
    backgroundColor: ROW_DEFAULTS.backgroundColor,
    label: `Row ${index + 1}`,
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

interface EditorState {
  planogram: Planogram;
  selection: Selection;
  zoom: number;
  hydrated: boolean;
  hoverDropTarget: { shelfId: string; rowId: RowSlot } | null;

  setHydrated: (v: boolean) => void;
  setName: (name: string) => void;
  setCanvasSize: (w: number, h: number) => void;
  setMeta: (patch: Partial<Planogram["meta"]>) => void;

  setZoom: (z: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;

  select: (s: Selection) => void;
  setHoverDropTarget: (t: { shelfId: string; rowId: RowSlot } | null) => void;

  addShelf: () => string;
  updateShelf: (id: string, patch: Partial<Shelf>) => void;
  removeShelf: (id: string) => void;

  addRow: (shelfId: string) => string;
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
  persist(
    immer((set) => ({
      planogram: makeInitialPlanogram(),
      selection: { kind: "none" },
      zoom: 1,
      hydrated: false,
      hoverDropTarget: null,

      setHydrated: (v) =>
        set((s) => {
          s.hydrated = v;
        }),

      setName: (name) =>
        set((s) => {
          s.planogram.name = name;
          s.planogram.updatedAt = new Date().toISOString();
        }),

      setCanvasSize: (w, h) =>
        set((s) => {
          s.planogram.canvasWidthMm = w;
          s.planogram.canvasHeightMm = h;
          s.planogram.updatedAt = new Date().toISOString();
        }),

      setMeta: (patch) =>
        set((s) => {
          s.planogram.meta = { ...s.planogram.meta, ...patch };
          s.planogram.updatedAt = new Date().toISOString();
        }),

      setZoom: (z) =>
        set((s) => {
          s.zoom = Math.min(2, Math.max(0.4, z));
        }),
      zoomIn: () =>
        set((s) => {
          s.zoom = Math.min(2, Math.round((s.zoom + 0.1) * 100) / 100);
        }),
      zoomOut: () =>
        set((s) => {
          s.zoom = Math.max(0.4, Math.round((s.zoom - 0.1) * 100) / 100);
        }),
      resetZoom: () =>
        set((s) => {
          s.zoom = 1;
        }),

      select: (sel) =>
        set((s) => {
          s.selection = sel;
        }),

      setHoverDropTarget: (t) =>
        set((s) => {
          s.hoverDropTarget = t;
        }),

      addShelf: () => {
        const id = nanoid();
        set((s) => {
          const last = s.planogram.shelves[s.planogram.shelves.length - 1];
          const lastBottomMm = last
            ? last.yMm + last.topAreaMm + last.rows.reduce((a, r) => a + r.heightMm, 0)
            : 50;
          const newShelf: Shelf = {
            id,
            index: s.planogram.shelves.length,
            xMm: 50,
            yMm: lastBottomMm + 20,
            widthMm: SHELF_DEFAULTS.widthMm,
            topAreaMm: SHELF_DEFAULTS.topAreaMm,
            rows: [makeRow(0, SHELF_DEFAULTS.widthMm)],
            borderWidthPx: SHELF_DEFAULTS.borderWidthPx,
            borderColor: SHELF_DEFAULTS.borderColor,
            backgroundColor: SHELF_DEFAULTS.backgroundColor,
            label: `Shelf ${s.planogram.shelves.length + 1}`,
          };
          s.planogram.shelves.push(newShelf);
          s.planogram.updatedAt = new Date().toISOString();
          s.selection = { kind: "shelf", id };
        });
        return id;
      },

      updateShelf: (id, patch) =>
        set((s) => {
          const shelf = s.planogram.shelves.find((sh) => sh.id === id);
          if (shelf) {
            Object.assign(shelf, patch);
            s.planogram.updatedAt = new Date().toISOString();
          }
        }),

      removeShelf: (id) =>
        set((s) => {
          s.planogram.shelves = s.planogram.shelves.filter((sh) => sh.id !== id);
          s.planogram.placements = s.planogram.placements.filter((p) => p.shelfId !== id);
          s.planogram.shelves.forEach((sh, idx) => (sh.index = idx));
          s.planogram.updatedAt = new Date().toISOString();
          if (s.selection.kind === "shelf" && s.selection.id === id) {
            s.selection = { kind: "none" };
          }
        }),

      addRow: (shelfId) => {
        const rowId = nanoid();
        set((s) => {
          const shelf = s.planogram.shelves.find((sh) => sh.id === shelfId);
          if (!shelf) return;
          const newRow = makeRow(shelf.rows.length, shelf.widthMm, { id: rowId });
          shelf.rows.push(newRow);
          s.planogram.updatedAt = new Date().toISOString();
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
          s.planogram.updatedAt = new Date().toISOString();
        }),

      updateRow: (shelfId, rowId, patch) =>
        set((s) => {
          const shelf = s.planogram.shelves.find((sh) => sh.id === shelfId);
          if (!shelf) return;
          const row = shelf.rows.find((r) => r.id === rowId);
          if (row) {
            Object.assign(row, patch);
            s.planogram.updatedAt = new Date().toISOString();
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
          s.planogram.updatedAt = new Date().toISOString();
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
          s.planogram.updatedAt = new Date().toISOString();
          s.selection = { kind: "placement", id: instanceId };
        });
        return instanceId;
      },

      updatePlacement: (id, patch) =>
        set((s) => {
          const p = s.planogram.placements.find((pp) => pp.instanceId === id);
          if (p) {
            Object.assign(p, patch);
            s.planogram.updatedAt = new Date().toISOString();
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
            s.planogram.updatedAt = new Date().toISOString();
          }
        }),

      removePlacement: (id) =>
        set((s) => {
          s.planogram.placements = s.planogram.placements.filter((p) => p.instanceId !== id);
          s.planogram.updatedAt = new Date().toISOString();
          if (s.selection.kind === "placement" && s.selection.id === id) {
            s.selection = { kind: "none" };
          }
        }),

      reset: () =>
        set((s) => {
          s.planogram = makeInitialPlanogram();
          s.selection = { kind: "none" };
          s.zoom = 1;
        }),
    })),
    {
      name: "planogram-editor-v3",
      skipHydration: true,
      partialize: (s) => ({ planogram: s.planogram, zoom: s.zoom }),
    }
  )
);
