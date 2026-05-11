"use client";
import * as React from "react";
import { useEditorStore } from "@/lib/store/editorStore";
import { useCatalogStore, toEditorProduct } from "@/lib/store/catalogStore";
import type { RowSlot } from "@/lib/types";
import { Copy, ClipboardPaste, CopyPlus, Trash2, ChevronRight } from "lucide-react";

/** Floating right-click menu for placements. Mounted once at the editor root;
 *  position + targets are driven by the `contextMenu` field on the store. */
export function PlacementContextMenu() {
  const ctx = useEditorStore((s) => s.contextMenu);
  const closeContextMenu = useEditorStore((s) => s.closeContextMenu);
  const copySelectionToClipboard = useEditorStore((s) => s.copySelectionToClipboard);
  const pasteClipboardTo = useEditorStore((s) => s.pasteClipboardTo);
  const duplicateSelection = useEditorStore((s) => s.duplicateSelection);
  const removePlacements = useEditorStore((s) => s.removePlacements);
  const placements = useEditorStore((s) => s.planogram.placements);
  const shelves = useEditorStore((s) => s.planogram.shelves);
  const clipboard = useEditorStore((s) => s.clipboard);
  const products = useCatalogStore((s) => s.products);

  const menuRef = React.useRef<HTMLDivElement | null>(null);

  // Dismiss on outside click / Escape / scroll.
  React.useEffect(() => {
    if (!ctx) return;
    function onDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    }
    function onScroll() {
      closeContextMenu();
    }
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [ctx, closeContextMenu]);

  if (!ctx) return null;
  // Bind to a local non-null reference so closures below keep the narrowed type.
  const menu = ctx;

  const targetPlacements = placements.filter((p) => menu.placementIds.includes(p.instanceId));
  const isMulti = targetPlacements.length > 1;
  const firstTarget = targetPlacements[0];
  const productName = firstTarget
    ? (() => {
        const raw = products.find((p) => p.productId === firstTarget.productId);
        return raw ? toEditorProduct(raw).name : "Product";
      })()
    : "";
  const headerLabel = isMulti ? `${targetPlacements.length} placements` : productName;

  // The current shelf is always shelves[0] in this app's model.
  const shelf = shelves[0];
  // "Paste to shelf →" submenu lists other inner rows (and "top" if present)
  // — only the ones where the user could plausibly want to land the clipboard.
  const pasteTargets: { id: RowSlot; label: string }[] = shelf
    ? [
        ...(shelf.topAreaMm > 0 ? [{ id: "top" as RowSlot, label: "Top area" }] : []),
        ...shelf.rows.map((r) => ({ id: r.id as RowSlot, label: r.label ?? `Shelf ${r.index + 1}` })),
      ]
    : [];

  function handlePasteToTarget(rowId: RowSlot) {
    if (!shelf) return;
    closeContextMenu();
    pasteClipboardTo({ shelfId: shelf.id, rowId, xMm: 20, yMm: 0 });
  }

  function handleCopy() {
    copySelectionToClipboard();
    closeContextMenu();
  }
  function handleDuplicate() {
    duplicateSelection({ dxMm: 20, dyMm: 0 });
    closeContextMenu();
  }
  function handlePasteHere() {
    if (!firstTarget) return;
    closeContextMenu();
    pasteClipboardTo({
      shelfId: firstTarget.shelfId,
      rowId: firstTarget.rowId,
      xMm: firstTarget.xMm + 20,
      yMm: firstTarget.yMm,
    });
  }
  function handleDelete() {
    removePlacements(menu.placementIds);
    closeContextMenu();
  }

  // Clamp the menu to the viewport so it doesn't fall off the right/bottom edge.
  const MENU_W = 232;
  const MENU_H = 220; // rough estimate; submenu can extend
  const x = Math.min(menu.x, (typeof window !== "undefined" ? window.innerWidth : 1024) - MENU_W - 8);
  const y = Math.min(menu.y, (typeof window !== "undefined" ? window.innerHeight : 768) - MENU_H - 8);

  return (
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-[100] min-w-[14rem] rounded-md border border-slate-200 bg-white p-1 shadow-lg text-sm"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-slate-400 truncate">
        {headerLabel}
      </div>
      <MenuItem icon={<Copy className="h-3.5 w-3.5" />} onClick={handleCopy} shortcut="⌘C">
        Copy
      </MenuItem>
      <MenuItem icon={<CopyPlus className="h-3.5 w-3.5" />} onClick={handleDuplicate} shortcut="⌘D">
        Duplicate in place
      </MenuItem>
      <MenuItem
        icon={<ClipboardPaste className="h-3.5 w-3.5" />}
        onClick={handlePasteHere}
        disabled={!clipboard || clipboard.entries.length === 0 || !firstTarget}
        shortcut="⌘V"
      >
        Paste here
      </MenuItem>
      <PasteToSubmenu
        targets={pasteTargets}
        disabled={!clipboard || clipboard.entries.length === 0 || !shelf}
        onPick={handlePasteToTarget}
      />
      <div className="my-1 h-px bg-slate-200" />
      <MenuItem
        icon={<Trash2 className="h-3.5 w-3.5 text-rose-500" />}
        onClick={handleDelete}
        shortcut="Del"
        danger
      >
        {isMulti ? `Delete ${targetPlacements.length} items` : "Delete"}
      </MenuItem>
    </div>
  );
}

function MenuItem({
  icon,
  children,
  onClick,
  disabled,
  shortcut,
  danger,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  shortcut?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`relative w-full flex items-center gap-2 rounded-sm px-2 py-1.5 outline-none transition-colors ${
        disabled
          ? "opacity-40 pointer-events-none"
          : danger
          ? "text-rose-600 hover:bg-rose-50"
          : "text-slate-700 hover:bg-slate-100"
      }`}
    >
      <span className="grid place-items-center w-4">{icon}</span>
      <span className="flex-1 text-left">{children}</span>
      {shortcut ? (
        <span className="text-[10px] text-slate-400 tabular-nums">{shortcut}</span>
      ) : null}
    </button>
  );
}

function PasteToSubmenu({
  targets,
  disabled,
  onPick,
}: {
  targets: { id: RowSlot; label: string }[];
  disabled: boolean;
  onPick: (rowId: RowSlot) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const itemRef = React.useRef<HTMLButtonElement | null>(null);
  // Submenu opens to the right of the item; if it would overflow the viewport,
  // flip to the left side instead.
  const [flipLeft, setFlipLeft] = React.useState(false);
  React.useEffect(() => {
    if (!open || !itemRef.current) return;
    const rect = itemRef.current.getBoundingClientRect();
    setFlipLeft(rect.right + 200 > window.innerWidth);
  }, [open]);

  return (
    <div
      className="relative"
      onMouseEnter={() => !disabled && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={itemRef}
        type="button"
        disabled={disabled}
        className={`relative w-full flex items-center gap-2 rounded-sm px-2 py-1.5 outline-none transition-colors ${
          disabled ? "opacity-40 pointer-events-none" : "text-slate-700 hover:bg-slate-100"
        }`}
      >
        <span className="grid place-items-center w-4">
          <ClipboardPaste className="h-3.5 w-3.5" />
        </span>
        <span className="flex-1 text-left">Paste to shelf</span>
        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
      </button>
      {open ? (
        <div
          className="absolute top-0 z-[101] min-w-[10rem] rounded-md border border-slate-200 bg-white p-1 shadow-lg"
          style={flipLeft ? { right: "100%", marginRight: 4 } : { left: "100%", marginLeft: 4 }}
        >
          {targets.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-slate-400">No shelves yet</div>
          ) : (
            targets.map((t) => (
              <button
                key={String(t.id)}
                type="button"
                onClick={() => onPick(t.id)}
                className="w-full text-left rounded-sm px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
              >
                {t.label}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
