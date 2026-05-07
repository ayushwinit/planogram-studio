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
import { useEditorStore } from "@/lib/store/editorStore";
import { useCatalogStore } from "@/lib/store/catalogStore";
import { defaultArrangement } from "@/lib/arrangement";
import { Toolbar } from "./Toolbar";
import { LeftPanel } from "./LeftPanel/LeftPanel";
import { Canvas } from "./Canvas/Canvas";
import { RightPanel } from "./RightPanel/RightPanel";
import { PlaceProductModal, type PendingPlacement } from "./modals/PlaceProductModal";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { ProductCardPreview } from "./LeftPanel/ProductCardPreview";

export default function EditorShell() {
  const setHydrated = useEditorStore((s) => s.setHydrated);
  const hydrated = useEditorStore((s) => s.hydrated);
  const addPlacement = useEditorStore((s) => s.addPlacement);
  const movePlacement = useEditorStore((s) => s.movePlacement);
  const placements = useEditorStore((s) => s.planogram.placements);
  const select = useEditorStore((s) => s.select);
  const removePlacement = useEditorStore((s) => s.removePlacement);
  const removeShelf = useEditorStore((s) => s.removeShelf);
  const selection = useEditorStore((s) => s.selection);
  const zoom = useEditorStore((s) => s.zoom);
  const setHoverDropTarget = useEditorStore((s) => s.setHoverDropTarget);

  const getProduct = useCatalogStore((s) => s.getProduct);

  // Hydrate persisted store on mount only on client
  React.useEffect(() => {
    useEditorStore.persist
      .rehydrate()
      ?.then(() => setHydrated(true))
      .catch(() => setHydrated(true));
  }, [setHydrated]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const [pending, setPending] = React.useState<PendingPlacement | null>(null);
  const [activeDrag, setActiveDrag] = React.useState<{
    kind: "product" | "placement";
    productId?: string;
    placementId?: string;
  } | null>(null);

  function handleDragStart(e: DragStartEvent) {
    const data = e.active.data.current as
      | { kind: "product"; productId: string }
      | { kind: "placement"; placementId: string }
      | undefined;
    if (!data) return;
    setActiveDrag(data.kind === "product"
      ? { kind: "product", productId: data.productId }
      : { kind: "placement", placementId: data.placementId });
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
    // yMm always 0 so products sit cleanly on the row's floor (organized look).
    const overRect = over.rect;
    const activeRect = active.rect.current.translated;
    let xMm = 20;
    const yMm = 0;
    if (overRect && activeRect) {
      const PX_PER_MM = 1.5 * zoom;
      xMm = Math.max(0, (activeRect.left - overRect.left) / PX_PER_MM);
      // Clamp inside the row so it doesn't overflow on the right.
      const maxXMm = Math.max(0, overRect.width / PX_PER_MM - 10);
      xMm = Math.min(xMm, maxXMm);
    }

    if (activeData.kind === "product") {
      const product = getProduct(activeData.productId);
      if (!product) return;
      setPending({
        productId: product.id,
        shelfId: overData.shelfId,
        rowId: overData.rowId,
        xMm,
        yMm,
        arrangement: defaultArrangement(),
        rotationDeg: 0,
      });
    } else {
      movePlacement(activeData.placementId, {
        shelfId: overData.shelfId,
        rowId: overData.rowId,
        xMm,
        yMm,
      });
    }
  }

  const removeRow = useEditorStore((s) => s.removeRow);
  // Keyboard: Delete removes selection, Escape clears selection
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.key === "Escape") select({ kind: "none" });
      if ((e.key === "Delete" || e.key === "Backspace") && selection.kind !== "none") {
        if (selection.kind === "placement") removePlacement(selection.id);
        if (selection.kind === "shelf") removeShelf(selection.id);
        if (selection.kind === "row") removeRow(selection.shelfId, selection.id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, removePlacement, removeShelf, removeRow, select]);

  if (!hydrated) {
    return (
      <div className="h-full w-full flex items-center justify-center text-slate-400 text-sm">
        Loading editor…
      </div>
    );
  }

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
          <Toolbar />
          <div className="flex-1 min-h-0">
            <PanelGroup orientation="horizontal" className="h-full">
              <Panel id="left" defaultSize="20%" minSize="14%" maxSize="35%">
                <LeftPanel />
              </Panel>
              <PanelResizeHandle className="resize-handle-h" />
              <Panel id="center" defaultSize="56%" minSize="30%">
                <Canvas />
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

        <PlaceProductModal
          pending={pending}
          onClose={() => setPending(null)}
          onConfirm={(p) => {
            addPlacement({
              productId: p.productId,
              shelfId: p.shelfId,
              rowId: p.rowId,
              xMm: p.xMm,
              yMm: p.yMm,
              arrangement: p.arrangement,
              rotationDeg: p.rotationDeg,
            });
            setPending(null);
          }}
        />
      </DndContext>
    </TooltipProvider>
  );
}

export { useEditorStore as _store };
