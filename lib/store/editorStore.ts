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
import { arrangementMetrics, defaultArrangement } from "../arrangement";
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

// Auto-fit tuning. Clearance is the headroom deliberately left above the
// tallest product so a row never looks packed to the ceiling; the gap bounds
// keep products from either touching or drifting apart on a half-empty row.
const AUTOFIT_CLEARANCE_MM = 2;
const AUTOFIT_MIN_GAP_MM = 4;
const AUTOFIT_MAX_GAP_MM = 20;
// Mirrors SCALE_MIN in PlacedProductView so auto-fit can't produce a size the
// user is then unable to drag back.
const AUTOFIT_MIN_SCALE = 0.2;

/** How many planogram snapshots Ctrl+Z can walk back through. */
const HISTORY_LIMIT = 50;
/** Set while undo/redo is swapping the planogram, so the history subscription
 *  doesn't record that swap as a fresh edit. */
let applyingHistory = false;

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

/** Keep auto-generated "Shelf N" labels matching their position after an
 *  insert, delete or reorder. A label the user typed themselves is left alone —
 *  renaming it out from under them would be worse than a gap in the numbering. */
function renumberDefaultLabels(shelf: Shelf): void {
  shelf.rows.forEach((row, i) => {
    row.index = i;
    if (!row.label || /^Shelf \d+$/.test(row.label)) row.label = `Shelf ${i + 1}`;
  });
}

/** Lay one inner shelf out: scale each stack to clear the row height, shrink
 *  the row if it still overflows, then re-flow left-to-right with even gaps.
 *  Mutates the placements in place and returns how many it touched. Shared by
 *  the Auto-fit button and the text-based shelf builder, which both need the
 *  exact same result. */
function layoutRow(row: ShelfRow, items: PlacedProduct[]): number {
  const catalog = useCatalogStore.getState().products;
  let placed = 0;
        if (items.length === 0) return 0;

        const sized = items.map((p) => {
          const raw = catalog.find((c) => c.productId === p.productId);
          const m = raw ? arrangementMetrics(toEditorProduct(raw), p.arrangement) : null;
          const sx = p.scaleX ?? p.scale ?? 1;
          return {
            p,
            // Unscaled block size — auto-fit recomputes the scale from scratch.
            widthMm: m?.totalWidthMm ?? 0,
            heightMm: m?.totalHeightMm ?? 0,
            // Current on-shelf width, only used to work out what rests on what.
            currentWidthMm: (m?.totalWidthMm ?? 0) * sx,
          };
        });

        // Group into stacks so a product resting on another travels with it.
        // Bases sit on the floor; anything higher joins the base underneath its
        // left edge, and the members are ordered bottom-up.
        type Stack = { members: typeof sized; xMm: number };
        const bases = sized
          .filter((it) => it.p.yMm < 1)
          .sort((a, b) => a.p.xMm - b.p.xMm);
        const stacks: Stack[] = bases.map((b) => ({ members: [b], xMm: b.p.xMm }));
        for (const it of sized.filter((x) => x.p.yMm >= 1).sort((a, b) => a.p.yMm - b.p.yMm)) {
          // Pick the stack this one physically sits over — the widest overlap
          // wins. Testing the left edge alone missed a wide product centred on
          // a narrow one, whose left edge falls outside the base entirely.
          let host: Stack | undefined;
          let bestOverlap = 0;
          for (const st of stacks) {
            const left = Math.min(...st.members.map((m) => m.p.xMm));
            const right = Math.max(...st.members.map((m) => m.p.xMm + m.currentWidthMm));
            const overlap =
              Math.min(right, it.p.xMm + it.currentWidthMm) - Math.max(left, it.p.xMm);
            if (overlap > bestOverlap) {
              bestOverlap = overlap;
              host = st;
            }
          }
          // An orphan (nothing underneath it) becomes a stack of its own and
          // is dropped back to the floor.
          if (host) host.members.push(it);
          else stacks.push({ members: [it], xMm: it.p.xMm });
        }
        stacks.sort((a, b) => a.xMm - b.xMm);

        // One scale per stack: the whole column has to clear the row height, and
        // a shared scale keeps the products' relative sizes honest. Capped at 1
        // so a small pack is never blown up to look like a big one.
        const availHeightMm = Math.max(1, row.heightMm - AUTOFIT_CLEARANCE_MM);
        const scales = stacks.map((st) => {
          const stackHeightMm = st.members.reduce((sum, m) => sum + m.heightMm, 0);
          return stackHeightMm > 0 ? Math.min(1, availHeightMm / stackHeightMm) : 1;
        });

        // A second, row-wide shrink if the stacks still overflow horizontally.
        const stackWidth = (i: number) =>
          Math.max(...stacks[i].members.map((m) => m.widthMm)) * scales[i];
        const gapsMm = AUTOFIT_MIN_GAP_MM * (stacks.length + 1);
        const usedMm = stacks.reduce((sum, _, i) => sum + stackWidth(i), 0);
        if (usedMm > 0 && usedMm + gapsMm > row.widthMm) {
          const factor = Math.max(0, row.widthMm - gapsMm) / usedMm;
          for (let i = 0; i < scales.length; i++) {
            scales[i] = Math.max(AUTOFIT_MIN_SCALE, scales[i] * factor);
          }
        }
        for (let i = 0; i < scales.length; i++) scales[i] = Math.round(scales[i] * 100) / 100;

        const finalUsedMm = stacks.reduce((sum, _, i) => sum + stackWidth(i), 0);
        const gapMm = Math.min(
          AUTOFIT_MAX_GAP_MM,
          Math.max(AUTOFIT_MIN_GAP_MM, (row.widthMm - finalUsedMm) / (stacks.length + 1)),
        );

        let xMm = gapMm;
        for (let i = 0; i < stacks.length; i++) {
          const scale = scales[i];
          const slotWidthMm = stackWidth(i);
          let yMm = 0;
          for (const m of stacks[i].members) {
            // Narrower members sit centred on the one below rather than
            // left-aligned, which is how a real stack looks.
            const offsetMm = (slotWidthMm - m.widthMm * scale) / 2;
            m.p.xMm = Math.round((xMm + offsetMm) * 100) / 100;
            m.p.yMm = Math.round(yMm * 100) / 100;
            m.p.scaleX = scale;
            m.p.scaleY = scale;
            // Legacy uniform scale would otherwise win on old placements.
            delete m.p.scale;
            yMm += m.heightMm * scale;
            placed++;
          }
          xMm += slotWidthMm + gapMm;
        }
  return placed;
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
  /** Copy shelves out of `source` onto this canvas. Pass `rowIds` to bring over
   *  only those inner shelves (and their placements); omit it for the lot.
   *  `mode: "append"` keeps what is already on the canvas and adds the incoming
   *  shelves below it — that is how a planogram is assembled from several
   *  sources. Returns how many shelves were actually added, which is less than
   *  asked for when the unit hits MAX_INNER_SHELVES. */
  importFromPlanogram: (
    source: Planogram,
    rowIds?: string[],
    mode?: "replace" | "append",
  ) => number;
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

  /** Add one inner shelf. `atIndex` is the position it should occupy — 0 puts
   *  it at the top, omitted appends to the bottom. Default "Shelf N" labels
   *  below the insert renumber to match. */
  addInnerShelf: (shelfId: string, atIndex?: number) => string | null;
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
  /** Drop a product onto the shelf without the user aiming: it lands on the
   *  selected shelf (or the first one), to the right of whatever is already
   *  there, and ends up selected so the right panel opens on it. Returns null
   *  when there is no shelf to place on. */
  placeProductOnSelectedRow: (productId: string) => string | null;
  updatePlacement: (id: string, patch: Partial<PlacedProduct>) => void;
  movePlacement: (
    id: string,
    target: { shelfId: string; rowId: RowSlot; xMm: number; yMm: number }
  ) => void;
  removePlacement: (id: string) => void;
  /** Bulk delete — used by multi-select Delete. */
  removePlacements: (ids: string[]) => void;

  /** Tidy every row of one shelf in a single click: scale each placement
   *  uniformly so it clears its row height, shrink the whole row by one common
   *  factor if it still overflows the row width, then re-flow left-to-right
   *  with even gaps, sitting on the shelf floor. Unit counts (rows x cols) and
   *  the existing left-to-right order are never changed. Returns the number of
   *  placements it touched. */
  autoFitShelf: (shelfId: string) => number;

  /** Build whole shelves from a typed list. Entry i describes inner shelf i:
   *  its products, left to right, one facing each. Existing shelves are emptied
   *  and refilled; missing ones are created (up to MAX_INNER_SHELVES); shelves
   *  the list doesn't mention are left alone. Laid out with the same maths as
   *  Auto-fit, and recorded as a single undo step. Returns the shelves built. */
  applyShelfPlan: (plan: { productIds: string[] }[]) => number;

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

  /** Delete every placement on one inner shelf, leaving the shelf itself (and
   *  its label, height and colours) in place. Returns how many were removed. */
  clearRowContents: (shelfId: string, rowId: string) => number;

  /** Exchange the products of two inner shelves. Labels stay with the POSITION,
   *  never with the products: the top shelf is always "Shelf 1", so the saved
   *  JSON the detection system reads is numbered top-to-bottom 1..n. */
  swapRowContents: (shelfId: string, rowIdA: string, rowIdB: string) => void;

  reset: () => void;

  /** Previous / redoable planogram snapshots, newest last in `past`. Captured
   *  automatically by the subscription below — no action pushes to them. */
  past: Planogram[];
  future: Planogram[];
  undo: () => void;
  redo: () => void;
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
    past: [],
    future: [],

    undo: () => {
      const { past, planogram, future } = get();
      if (past.length === 0) return;
      applyingHistory = true;
      set((s) => {
        s.past = past.slice(0, -1);
        s.future = [planogram, ...future].slice(0, HISTORY_LIMIT);
        s.planogram = past[past.length - 1];
        s.selection = { kind: "none" };
        s.dirtySinceSave = true;
      });
      applyingHistory = false;
    },

    redo: () => {
      const { past, planogram, future } = get();
      if (future.length === 0) return;
      applyingHistory = true;
      set((s) => {
        s.past = [...past, planogram].slice(-HISTORY_LIMIT);
        s.future = future.slice(1);
        s.planogram = future[0];
        s.selection = { kind: "none" };
        s.dirtySinceSave = true;
      });
      applyingHistory = false;
    },

    // Loading a saved planogram is not an edit — it starts a fresh history.
    hydrate: (input) => {
      applyingHistory = true;
      set((s) => {
        s.past = [];
        s.future = [];
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
      });
      applyingHistory = false;
    },

    importFromPlanogram: (source, rowIds, mode = "replace") => {
      let added = 0;
      set((s) => {
        // Undefined means "everything"; an explicit list narrows the import to
        // the shelves the user ticked, renumbering so they stay 1..n.
        const wanted = rowIds ? new Set(rowIds) : null;
        // Regenerate every shelf / row / placement id so the imported nodes
        // can't collide with anything that referenced the original IDs (e.g.
        // if the user imports the same source twice). Placements need their
        // shelfId/rowId references remapped to the new ids.
        const shelfIdMap = new Map<string, string>();
        const rowIdMap = new Map<string, string>();

        const newShelves = source.shelves.map((shelf) => {
          const newShelfId = nanoid();
          shelfIdMap.set(shelf.id, newShelfId);
          const newRows = shelf.rows
            .filter((row) => !wanted || wanted.has(row.id))
            .map((row, i) => {
              const newRowId = nanoid();
              rowIdMap.set(row.id, newRowId);
              return { ...row, id: newRowId, index: i };
            });
          return { ...shelf, id: newShelfId, rows: newRows };
        });

        const newPlacements = source.placements
          .map((p) => {
            const newShelfId = shelfIdMap.get(p.shelfId);
            if (!newShelfId) return null;
            // rowId is either a real row id or the literal "top" sentinel.
            const newRowId = p.rowId === "top" ? "top" : rowIdMap.get(p.rowId);
            if (!newRowId) return null;
            return { ...p, instanceId: nanoid(), shelfId: newShelfId, rowId: newRowId };
          })
          .filter((p): p is NonNullable<typeof p> => p !== null);

        const target = s.planogram.shelves[0];
        if (mode === "append" && target) {
          // Incoming rows join the existing unit rather than forming a second
          // one, so they must adopt its id, width and row numbering.
          const room = MAX_INNER_SHELVES - target.rows.length;
          const incoming = newShelves.flatMap((sh) => sh.rows).slice(0, Math.max(0, room));
          const keep = new Set(incoming.map((r) => r.id));
          for (const row of incoming) {
            target.rows.push({ ...row, xMm: 0, widthMm: target.widthMm, index: target.rows.length });
          }
          for (const p of newPlacements) {
            if (!keep.has(p.rowId)) continue;
            s.planogram.placements.push({ ...p, shelfId: target.id });
          }
          added = incoming.length;
        } else {
          s.planogram.shelves = newShelves;
          s.planogram.placements = newPlacements;
          s.planogram.canvasWidthMm = source.canvasWidthMm;
          s.planogram.canvasHeightMm = source.canvasHeightMm;
          added = newShelves.reduce((n, sh) => n + sh.rows.length, 0);
        }
        s.selection = { kind: "none" };
        markEdit(s);
      });
      return added;
    },

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

    addInnerShelf: (shelfId, atIndex) => {
      const shelf = get().planogram.shelves.find((sh) => sh.id === shelfId);
      if (!shelf) return null;
      if (shelf.rows.length >= MAX_INNER_SHELVES) return null;
      const rowId = nanoid();
      set((s) => {
        const sh = s.planogram.shelves.find((x) => x.id === shelfId);
        if (!sh) return;
        const at = atIndex === undefined ? sh.rows.length : Math.max(0, Math.min(atIndex, sh.rows.length));
        sh.rows.splice(at, 0, makeInnerShelf(at, sh.widthMm, { id: rowId }));
        renumberDefaultLabels(sh);
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
        renumberDefaultLabels(shelf);
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
        renumberDefaultLabels(shelf);
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

    placeProductOnSelectedRow: (productId) => {
      const state = get();
      const shelf = state.planogram.shelves[0];
      if (!shelf) return null;

      // Whatever the user last clicked wins: a selected shelf, or the shelf of a
      // selected placement. Otherwise the first shelf.
      const sel = state.selection;
      let rowId: RowSlot | null = null;
      if (sel.kind === "row" && sel.shelfId === shelf.id) rowId = sel.id;
      else if (sel.kind === "placement" && sel.ids.length > 0) {
        rowId = state.planogram.placements.find((p) => p.instanceId === sel.ids[0])?.rowId ?? null;
      }
      if (!rowId) rowId = shelf.rows[0]?.id ?? null;
      if (!rowId) return null;

      const row = shelf.rows.find((r) => r.id === rowId);
      const arrangement = defaultArrangement();

      // Park it just past the rightmost thing on that shelf so it never lands
      // on top of existing stock; wrap back to the left once the shelf is full.
      const occupied = state.planogram.placements.filter(
        (p) => p.shelfId === shelf.id && p.rowId === rowId,
      );
      let xMm = 20;
      for (const p of occupied) {
        xMm = Math.max(xMm, p.xMm + footprintWidthMm(p) + 10);
      }
      const raw = useCatalogStore.getState().products.find((c) => c.productId === productId);
      const widthMm = raw
        ? arrangementMetrics(toEditorProduct(raw), arrangement).totalWidthMm
        : 0;
      if (row && xMm + widthMm > row.widthMm) xMm = 20;

      return get().addPlacement({
        productId,
        shelfId: shelf.id,
        rowId,
        xMm,
        yMm: 0,
        arrangement,
        rotationDeg: 0,
      });
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

    applyShelfPlan: (plan) => {
      let built = 0;
      set((s) => {
        if (plan.length === 0) return;

        if (s.planogram.shelves.length === 0) {
          s.planogram.shelves.push({
            id: nanoid(),
            index: 0,
            xMm: 0,
            yMm: 0,
            rows: [],
            ...SHELF_DEFAULTS,
          });
        }
        const shelf = s.planogram.shelves[0];
        const wanted = Math.min(plan.length, MAX_INNER_SHELVES);
        while (shelf.rows.length < wanted) {
          shelf.rows.push(makeInnerShelf(shelf.rows.length, shelf.widthMm));
        }
        renumberDefaultLabels(shelf);

        for (let i = 0; i < wanted; i++) {
          const row = shelf.rows[i];
          // The line describes the whole shelf, so it replaces what was there.
          s.planogram.placements = s.planogram.placements.filter(
            (p) => !(p.shelfId === shelf.id && p.rowId === row.id),
          );
          const fresh: PlacedProduct[] = plan[i].productIds.map((productId, n) => ({
            instanceId: nanoid(),
            productId,
            shelfId: shelf.id,
            rowId: row.id,
            // Seeded in list order and spaced apart; layoutRow does the real
            // positioning, but it sorts by x, so the order must be right here.
            xMm: n * 1000,
            yMm: 0,
            arrangement: defaultArrangement(),
            rotationDeg: 0,
          }));
          s.planogram.placements.push(...fresh);
          layoutRow(row, fresh);
          built++;
        }
        s.selection = { kind: "none" };
        markEdit(s);
      });
      return built;
    },

    autoFitShelf: (shelfId) => {
      let touched = 0;
      set((s) => {
        const shelf = s.planogram.shelves.find((sh) => sh.id === shelfId);
        if (!shelf) return;
        for (const row of shelf.rows) {
          touched += layoutRow(
            row,
            s.planogram.placements.filter((p) => p.shelfId === shelfId && p.rowId === row.id),
          );
        }
        if (touched > 0) markEdit(s);
      });
      return touched;
    },

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

    clearRowContents: (shelfId, rowId) => {
      let removed = 0;
      set((s) => {
        const before = s.planogram.placements.length;
        s.planogram.placements = s.planogram.placements.filter(
          (p) => !(p.shelfId === shelfId && p.rowId === rowId),
        );
        removed = before - s.planogram.placements.length;
        if (removed === 0) return;
        // Anything selected on that shelf is gone, so the right panel must not
        // keep pointing at it.
        if (s.selection.kind === "placement") {
          const alive = new Set(s.planogram.placements.map((p) => p.instanceId));
          const next = s.selection.ids.filter((id) => alive.has(id));
          s.selection = next.length === 0 ? { kind: "none" } : { kind: "placement", ids: next };
        }
        markEdit(s);
      });
      return removed;
    },

    swapRowContents: (shelfId, rowIdA, rowIdB) =>
      set((s) => {
        if (rowIdA === rowIdB) return;
        const shelf = s.planogram.shelves.find((sh) => sh.id === shelfId);
        if (!shelf) return;
        const a = shelf.rows.find((r) => r.id === rowIdA);
        const b = shelf.rows.find((r) => r.id === rowIdB);
        if (!a || !b) return;

        for (const p of s.planogram.placements) {
          if (p.shelfId !== shelfId) continue;
          if (p.rowId === rowIdA) p.rowId = rowIdB;
          else if (p.rowId === rowIdB) p.rowId = rowIdA;
        }

        // Height swaps so the products still fit the shelf they moved to; the
        // label does NOT — see the doc comment.
        const h = a.heightMm;
        a.heightMm = b.heightMm;
        b.heightMm = h;

        markEdit(s);
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

// Every mutating action replaces `planogram` wholesale (immer), so a change in
// its identity is exactly "an edit happened" — that is the undo checkpoint.
// Recording here rather than inside each action means no action can forget to.
useEditorStore.subscribe((state, prev) => {
  if (applyingHistory) return;
  if (state.planogram === prev.planogram) return;
  applyingHistory = true;
  useEditorStore.setState({
    past: [...prev.past, prev.planogram].slice(-HISTORY_LIMIT),
    future: [],
  });
  applyingHistory = false;
});

export const MAX_INNER_SHELVES_LIMIT = MAX_INNER_SHELVES;
