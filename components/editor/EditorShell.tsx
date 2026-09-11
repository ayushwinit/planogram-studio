"use client";
import * as React from "react";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  rectIntersection,
  DragOverlay,
} from "@dnd-kit/core";
import type { RowSlot } from "@/lib/types";
import type { TenantProduct } from "@/lib/catalog/types";
import { useEditorStore } from "@/lib/store/editorStore";
import { useCatalogStore } from "@/lib/store/catalogStore";
import { defaultArrangement } from "@/lib/arrangement";
import { placementSize, restingYMm } from "@/lib/placementGeometry";
import { Toolbar, type ToolbarUser, type ToolbarTenant } from "./Toolbar";
import { CanvasToolbar } from "./CanvasToolbar";
import { LeftPanel } from "./LeftPanel/LeftPanel";
import { Canvas } from "./Canvas/Canvas";
import { RightPanel } from "./RightPanel/RightPanel";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { ProductCardPreview } from "./LeftPanel/ProductCardPreview";
import { toast } from "sonner";
import { PlacementContextMenu } from "./Canvas/PlacementContextMenu";

export interface EditorBinding {
  planogramId: string;
  tenantSlug: string;
  planogramSlug: string;
  planogram: import("@/lib/types").Planogram;
  customerName: string;
  lastSavedAt: string;
}

export default function EditorShell({
  user,
  tenant,
  initialProducts,
  initialBinding,
}: {
  user: ToolbarUser;
  tenant: ToolbarTenant;
  initialProducts: TenantProduct[];
  initialBinding: EditorBinding;
}) {
  const setProducts = useCatalogStore((s) => s.setProducts);
  const hydrate = useEditorStore((s) => s.hydrate);

  // Seed the catalog store from server-fetched products on mount, and again
  // whenever the prop changes (e.g. after a router.refresh() following an edit).
  React.useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts, setProducts]);

  // Hydrate the editor store with the saved planogram. Re-hydrate when the
  // bound planogramId changes (i.e. user navigated to a different one without
  // a full page reload).
  React.useEffect(() => {
    hydrate(initialBinding);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBinding.planogramId]);
  const addPlacement = useEditorStore((s) => s.addPlacement);
  const movePlacement = useEditorStore((s) => s.movePlacement);
  const placements = useEditorStore((s) => s.planogram.placements);
  const select = useEditorStore((s) => s.select);
  const removeShelf = useEditorStore((s) => s.removeShelf);
  const selection = useEditorStore((s) => s.selection);
  const zoom = useEditorStore((s) => s.zoom);
  const setHoverDropTarget = useEditorStore((s) => s.setHoverDropTarget);

  const getProduct = useCatalogStore((s) => s.getProduct);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const [activeDrag, setActiveDrag] = React.useState<{
    kind: "product" | "placement";
    productId?: string;
    placementId?: string;
    /** Held Alt at the start of the drag → clone instead of move on drop. */
    duplicate?: boolean;
  } | null>(null);

  function handleDragStart(e: DragStartEvent) {
    const data = e.active.data.current as
      | { kind: "product"; productId: string }
      | { kind: "placement"; placementId: string }
      | undefined;
    if (!data) return;
    // Read modifier off the originating pointer event so Alt-drag-to-clone
    // works without us having to track key state ourselves.
    const activator = e.activatorEvent as PointerEvent | undefined;
    const duplicate = !!activator?.altKey;
    setActiveDrag(
      data.kind === "product"
        ? { kind: "product", productId: data.productId }
        : { kind: "placement", placementId: data.placementId, duplicate },
    );
  }

  function handleDragOver(e: DragOverEvent) {
    const overData = e.over?.data.current as
      | { kind: "row"; shelfId: string; rowId: RowSlot }
      | undefined;
    if (overData?.kind === "row") {
      setHoverDropTarget({ shelfId: overData.shelfId, rowId: overData.rowId });
    } else {
      setHoverDropTarget(null);
    }
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveDrag(null);
    setHoverDropTarget(null);
    const { active, over } = e;
    if (!over) return;
    const overData = over.data.current as
      | { kind: "row"; shelfId: string; rowId: RowSlot }
      | undefined;
    if (!overData || overData.kind !== "row") return;

    const activeData = active.data.current as
      | { kind: "product"; productId: string }
      | { kind: "placement"; placementId: string }
      | undefined;
    if (!activeData) return;

    // Compute drop coords. xMm = where the LEFT edge of the placement should go inside the row.
    // yMm = how high above the row floor its BOTTOM edge sits, snapped either to
    // the floor or onto the top of whatever product was dropped on — that is how
    // two different products get stacked.
    const overRect = over.rect;
    const activeRect = active.rect.current.translated;
    let xMm = 20;
    let rawYMm = 0;
    if (overRect && activeRect) {
      const PX_PER_MM = 1.5 * zoom;
      xMm = Math.max(0, (activeRect.left - overRect.left) / PX_PER_MM);
      // Clamp inside the row so it doesn't overflow on the right.
      const maxXMm = Math.max(0, overRect.width / PX_PER_MM - 10);
      xMm = Math.min(xMm, maxXMm);
      // Screen y grows downwards, shelf y grows upwards from the row floor.
      rawYMm = Math.max(0, (overRect.top + overRect.height - activeRect.bottom) / PX_PER_MM);
    }

    const movingId =
      activeData.kind === "placement" && activeDrag?.kind === "placement" && !activeDrag.duplicate
        ? activeData.placementId
        : null;
    const siblings = placements
      .filter(
        (p) =>
          p.shelfId === overData.shelfId &&
          p.rowId === overData.rowId &&
          p.instanceId !== movingId,
      )
      .flatMap((p) => {
        const prod = getProduct(p.productId);
        return prod ? [{ placement: p, size: placementSize(prod, p) }] : [];
      });
    const yMm = restingYMm(xMm, rawYMm, siblings);

    if (activeData.kind === "product") {
      const product = getProduct(activeData.productId);
      if (!product) return;
      // Straight onto the shelf — quantity and arrangement are tuned in the
      // right panel, which opens on the new placement because addPlacement
      // selects it.
      addPlacement({
        productId: product.id,
        shelfId: overData.shelfId,
        rowId: overData.rowId,
        xMm,
        yMm,
        arrangement: defaultArrangement(),
        rotationDeg: 0,
      });
    } else {
      const wantDuplicate =
        activeDrag?.kind === "placement" && activeDrag.duplicate === true;
      if (wantDuplicate) {
        const src = placements.find((p) => p.instanceId === activeData.placementId);
        if (src) {
          useEditorStore.getState().addPlacement({
            productId: src.productId,
            shelfId: overData.shelfId,
            rowId: overData.rowId,
            xMm,
            yMm,
            arrangement: src.arrangement,
            rotationDeg: src.rotationDeg,
          });
          // Carry over scale/notes that addPlacement doesn't accept directly.
          const newest = useEditorStore.getState().planogram.placements.slice(-1)[0];
          if (newest) {
            useEditorStore.getState().updatePlacement(newest.instanceId, {
              scaleX: src.scaleX,
              scaleY: src.scaleY,
              scale: src.scale,
              notes: src.notes,
            });
          }
        }
      } else {
        movePlacement(activeData.placementId, {
          shelfId: overData.shelfId,
          rowId: overData.rowId,
          xMm,
          yMm,
        });
      }
    }
  }

  const removeRow = useEditorStore((s) => s.removeRow);
  const removePlacements = useEditorStore((s) => s.removePlacements);
  const updatePlacement = useEditorStore((s) => s.updatePlacement);
  const copySelectionToClipboard = useEditorStore((s) => s.copySelectionToClipboard);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const pasteClipboardTo = useEditorStore((s) => s.pasteClipboardTo);
  const duplicateSelection = useEditorStore((s) => s.duplicateSelection);
  const clipboard = useEditorStore((s) => s.clipboard);
  const closeContextMenu = useEditorStore((s) => s.closeContextMenu);

  // Keyboard:
  //  - Escape clears selection / context menu
  //  - Delete/Backspace removes the selection (placement / shelf / row)
  //  - Arrow keys nudge the selected placement(s) (1mm, or 10mm with Shift)
  //  - Ctrl/Cmd+C copy, Ctrl/Cmd+V paste, Ctrl/Cmd+D duplicate
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.key === "Escape") {
        closeContextMenu();
        select({ kind: "none" });
        return;
      }

      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.shiftKey && !e.altKey && (e.key === "c" || e.key === "C")) {
        // Always preventDefault so the browser's "copy selected text" doesn't
        // race the action and so the toast feedback feels deterministic.
        e.preventDefault();
        if (selection.kind === "placement" && selection.ids.length > 0) {
          const n = copySelectionToClipboard();
          if (n > 0) toast.success(`Copied ${n} ${n === 1 ? "item" : "items"}`);
        }
        return;
      }
      if (mod && !e.shiftKey && !e.altKey && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        if (!clipboard || clipboard.entries.length === 0) return;
        // Paste anchor priority:
        //  1. A selected placement → drop into ITS row, 20mm right of it
        //  2. A selected row (user clicked the target shelf in the panel) →
        //     drop into that row, 20mm from the left
        //  3. Fallback → first row of the shelf
        const state = useEditorStore.getState();
        const placements = state.planogram.placements;
        let target: { shelfId: string; rowId: RowSlot; xMm: number; yMm: number } | null = null;
        const stateSel = state.selection;
        if (stateSel.kind === "placement" && stateSel.ids.length > 0) {
          const anchorId = stateSel.ids[0];
          const anchor = placements.find((p) => p.instanceId === anchorId);
          if (anchor) target = { shelfId: anchor.shelfId, rowId: anchor.rowId, xMm: anchor.xMm + 20, yMm: anchor.yMm };
        } else if (stateSel.kind === "row") {
          target = { shelfId: stateSel.shelfId, rowId: stateSel.id, xMm: 20, yMm: 0 };
        }
        if (!target) {
          const shelf = state.planogram.shelves[0];
          if (!shelf) return;
          const row = shelf.rows[0];
          if (!row) return;
          target = { shelfId: shelf.id, rowId: row.id, xMm: 20, yMm: 0 };
        }
        const created = pasteClipboardTo(target);
        if (created.length > 0) {
          toast.success(`Pasted ${created.length} ${created.length === 1 ? "item" : "items"}`);
        }
        return;
      }
      if (mod && !e.altKey && (e.key === "z" || e.key === "Z")) {
        // Ctrl+Shift+Z redoes, matching every other design tool.
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && !e.shiftKey && !e.altKey && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && !e.shiftKey && !e.altKey && (e.key === "d" || e.key === "D")) {
        // Ctrl+D is "Bookmark this page" in browsers — always preventDefault so
        // the bookmark dialog doesn't pop up and steal focus, even if there's
        // nothing to duplicate.
        e.preventDefault();
        if (selection.kind === "placement" && selection.ids.length > 0) {
          const ids = duplicateSelection({ dxMm: 20, dyMm: 0 });
          if (ids.length > 0) {
            toast.success(`Duplicated ${ids.length} ${ids.length === 1 ? "item" : "items"}`);
          }
        }
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selection.kind !== "none") {
        if (selection.kind === "placement") removePlacements(selection.ids);
        if (selection.kind === "shelf") removeShelf(selection.id);
        if (selection.kind === "row") removeRow(selection.shelfId, selection.id);
      }

      if (selection.kind === "placement" && e.key.startsWith("Arrow")) {
        const placements = useEditorStore.getState().planogram.placements;
        const idSet = new Set(selection.ids);
        const targets = placements.filter((p) => idSet.has(p.instanceId));
        if (targets.length === 0) return;
        const step = e.shiftKey ? 10 : 1;
        // y increases upwards (placement is positioned via `bottom: yMm` from
        // the row floor), so ArrowUp adds to y and ArrowDown subtracts.
        let dx = 0;
        let dy = 0;
        if (e.key === "ArrowLeft") dx = -step;
        else if (e.key === "ArrowRight") dx = step;
        else if (e.key === "ArrowUp") dy = step;
        else if (e.key === "ArrowDown") dy = -step;
        else return;
        e.preventDefault();
        for (const p of targets) {
          updatePlacement(p.instanceId, {
            xMm: Math.max(0, p.xMm + dx),
            yMm: Math.max(0, p.yMm + dy),
          });
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    selection,
    clipboard,
    removePlacements,
    removeShelf,
    removeRow,
    select,
    updatePlacement,
    copySelectionToClipboard,
    pasteClipboardTo,
    duplicateSelection,
    closeContextMenu,
    undo,
    redo,
  ]);

  // For DragOverlay
  const activeProduct = activeDrag?.kind === "product" && activeDrag.productId
    ? getProduct(activeDrag.productId) : undefined;
  const activePlacement = activeDrag?.kind === "placement" && activeDrag.placementId
    ? placements.find((p) => p.instanceId === activeDrag.placementId) : undefined;
  const activePlacementProduct = activePlacement ? getProduct(activePlacement.productId) : undefined;

  return (
    <TooltipProvider delayDuration={250}>
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setActiveDrag(null);
          setHoverDropTarget(null);
        }}
      >
        <div className="h-full flex flex-col bg-slate-100">
          <Toolbar user={user} tenant={tenant} />
          <div className="flex-1 min-h-0">
            <PanelGroup orientation="horizontal" className="h-full">
              <Panel id="left" defaultSize="20%" minSize="14%" maxSize="35%">
                <LeftPanel />
              </Panel>
              <PanelResizeHandle className="resize-handle-h" />
              <Panel id="center" defaultSize="56%" minSize="30%">
                <div className="h-full flex flex-col">
                  <CanvasToolbar />
                  <div className="flex-1 min-h-0">
                    <Canvas />
                  </div>
                </div>
              </Panel>
              <PanelResizeHandle className="resize-handle-h" />
              <Panel id="right" defaultSize="24%" minSize="16%" maxSize="36%">
                <RightPanel />
              </Panel>
            </PanelGroup>
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeProduct ? (
            <ProductCardPreview product={activeProduct} />
          ) : activePlacement && activePlacementProduct ? (
            <div
              className="rounded-md bg-white/80 border border-indigo-300 shadow-lg p-1"
              style={{ width: 80, height: 80 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activePlacementProduct.imageUrl}
                alt={activePlacementProduct.name}
                className="w-full h-full object-contain"
              />
            </div>
          ) : null}
        </DragOverlay>

        <PlacementContextMenu />
      </DndContext>
    </TooltipProvider>
  );
}

export { useEditorStore as _store };
