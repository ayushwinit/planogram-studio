"use client";
import * as React from "react";
import { Clipboard, X, ClipboardPaste } from "lucide-react";
import { useEditorStore } from "@/lib/store/editorStore";
import { useCatalogStore, toEditorProduct } from "@/lib/store/catalogStore";

/** Floating clipboard indicator overlaid on the canvas. Mounts only when there
 *  is something to paste. Click "Paste" to drop the clipboard at the centre of
 *  the selected row (or, if there's no selection, the first row of the shelf). */
export function ClipboardChip() {
  const clipboard = useEditorStore((s) => s.clipboard);
  const clearClipboard = useEditorStore((s) => s.clearClipboard);
  const pasteClipboardTo = useEditorStore((s) => s.pasteClipboardTo);
  const products = useCatalogStore((s) => s.products);

  if (!clipboard || clipboard.entries.length === 0) return null;

  const first = clipboard.entries[0];
  const rawProduct = products.find((p) => p.productId === first.productId);
  const productName = rawProduct ? toEditorProduct(rawProduct).name : "Items";
  const productImage = rawProduct ? toEditorProduct(rawProduct).imageUrl : undefined;
  const extra = clipboard.entries.length - 1;

  function handlePaste() {
    const state = useEditorStore.getState();
    const sel = state.selection;
    const placements = state.planogram.placements;
    if (sel.kind === "placement" && sel.ids.length > 0) {
      const anchor = placements.find((p) => p.instanceId === sel.ids[0]);
      if (anchor) {
        pasteClipboardTo({
          shelfId: anchor.shelfId,
          rowId: anchor.rowId,
          xMm: anchor.xMm + 20,
          yMm: anchor.yMm,
        });
        return;
      }
    }
    if (sel.kind === "row") {
      pasteClipboardTo({ shelfId: sel.shelfId, rowId: sel.id, xMm: 20, yMm: 0 });
      return;
    }
    const shelf = state.planogram.shelves[0];
    if (!shelf) return;
    const row = shelf.rows[0];
    if (!row) return;
    pasteClipboardTo({ shelfId: shelf.id, rowId: row.id, xMm: 20, yMm: 0 });
  }

  return (
    <div className="pointer-events-none absolute top-14 right-4 z-30">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-indigo-200 bg-white/95 backdrop-blur px-1.5 py-1 pr-1 shadow-md">
        <div className="grid h-6 w-6 place-items-center rounded-full bg-indigo-50 text-indigo-600">
          <Clipboard className="h-3.5 w-3.5" />
        </div>
        {productImage ? (
          <div className="h-6 w-6 rounded bg-slate-50 border border-slate-200 overflow-hidden grid place-items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={productImage} alt="" className="max-h-full max-w-full object-contain" />
          </div>
        ) : null}
        <div className="flex flex-col leading-tight pr-1">
          <span className="text-[11px] font-medium text-slate-700 truncate max-w-[8rem]">
            {productName}
          </span>
          <span className="text-[9px] text-slate-400 tabular-nums">
            {extra > 0 ? `+${extra} more` : "1 item"} · click a shelf, then Paste
          </span>
        </div>
        <button
          type="button"
          onClick={handlePaste}
          className="inline-flex items-center gap-1 rounded-full bg-indigo-600 text-white text-[11px] font-medium px-2.5 py-1 hover:bg-indigo-500 transition-colors"
        >
          <ClipboardPaste className="h-3 w-3" /> Paste
        </button>
        <button
          type="button"
          onClick={clearClipboard}
          aria-label="Clear clipboard"
          className="grid h-6 w-6 place-items-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
