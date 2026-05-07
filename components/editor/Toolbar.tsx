"use client";
import * as React from "react";
import {
  LayoutDashboard,
  Plus,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Save,
  Image as ImageIcon,
  FileText,
  FileJson,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import { useEditorStore } from "@/lib/store/editorStore";
import { saveAll, exportPng, exportJson, exportPdf } from "@/lib/export/savePipeline";

export function Toolbar() {
  const name = useEditorStore((s) => s.planogram.name);
  const setName = useEditorStore((s) => s.setName);
  const addShelf = useEditorStore((s) => s.addShelf);
  const zoom = useEditorStore((s) => s.zoom);
  const zoomIn = useEditorStore((s) => s.zoomIn);
  const zoomOut = useEditorStore((s) => s.zoomOut);
  const resetZoom = useEditorStore((s) => s.resetZoom);
  const reset = useEditorStore((s) => s.reset);

  return (
    <header className="h-14 shrink-0 flex items-center gap-3 px-4 border-b border-slate-200 bg-white shadow-sm z-10">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 grid place-items-center text-white shadow-sm">
          <LayoutDashboard className="h-4 w-4" />
        </div>
        <div className="font-semibold text-slate-900 leading-none">Planogram <span className="text-indigo-600">Studio</span></div>
      </div>

      <div className="h-6 w-px bg-slate-200 mx-1" />

      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="max-w-xs h-8 text-sm font-medium"
        placeholder="Planogram name"
      />

      <div className="h-6 w-px bg-slate-200 mx-1" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="sm" variant="primary" onClick={() => addShelf()} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Shelf
          </Button>
        </TooltipTrigger>
        <TooltipContent>Add a new shelf row to the canvas</TooltipContent>
      </Tooltip>

      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-md border border-slate-200 bg-white">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon-sm" variant="ghost" onClick={zoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom out</TooltipContent>
          </Tooltip>
          <button
            onClick={resetZoom}
            className="px-2 text-xs font-medium text-slate-700 tabular-nums hover:bg-slate-100 rounded"
            title="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon-sm" variant="ghost" onClick={zoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom in</TooltipContent>
          </Tooltip>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon-sm" variant="ghost" onClick={() => { if (confirm("Reset planogram? This clears all shelves and placements.")) reset(); }}>
              <Trash2 className="h-4 w-4 text-rose-500" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reset planogram</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="default" className="gap-1.5">
              <Save className="h-4 w-4" /> Save
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={saveAll}>
              <Save className="h-4 w-4" /> Save All (PNG + PDF + JSON)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={exportPng}>
              <ImageIcon className="h-4 w-4" /> Export PNG
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={exportPdf}>
              <FileText className="h-4 w-4" /> Export PDF
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={exportJson}>
              <FileJson className="h-4 w-4" /> Export JSON
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export { RotateCcw }; // unused but reserved for future
