"use client";
import * as React from "react";
import { toast } from "sonner";
import { ImagePlus, Trash2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { useCatalogStore } from "@/lib/store/catalogStore";
import type { TenantProduct, ItemDimensions } from "@/lib/catalog/types";
import {
  createTenantProduct,
  updateTenantProduct,
  deleteTenantProduct,
} from "@/lib/catalog/actions";

interface Props {
  open: boolean;
  onClose: () => void;
  /** When provided, dialog is in "edit" mode pre-filled with this product. */
  editing: TenantProduct | null;
}

interface FieldErrors {
  [key: string]: string | undefined;
}

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"];

export function CatalogItemDialog({ open, onClose, editing }: Props) {
  const upsertProduct = useCatalogStore((s) => s.upsertProduct);
  const removeProduct = useCatalogStore((s) => s.removeProduct);

  const [category, setCategory] = React.useState("");
  const [brand, setBrand] = React.useState("");
  const [itemCode, setItemCode] = React.useState("");
  const [barcode, setBarcode] = React.useState("");
  const [itemDescription, setItemDescription] = React.useState("");
  const [uom, setUom] = React.useState("");
  // Inputs are in centimetres for user-friendliness. Storage stays in mm
  // (the canvas/exports already speak mm), so we convert at the boundary —
  // mm/10 on load, cm*10 on save.
  const [widthCm, setWidthCm] = React.useState("");
  const [heightCm, setHeightCm] = React.useState("");
  const [depthCm, setDepthCm] = React.useState("");

  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [imageRemoved, setImageRemoved] = React.useState(false);

  // previewUrl is derived: a freshly picked file → blob URL; otherwise fall
  // back to the existing item's image (unless the user explicitly removed it).
  const imagePreviewUrl = React.useMemo<string | null>(() => {
    if (imageFile) return URL.createObjectURL(imageFile);
    if (imageRemoved) return null;
    if (editing?.itemImageUrl) return `/api/catalog/image/${editing.itemImageUrl}`;
    return null;
  }, [imageFile, imageRemoved, editing]);

  // Revoke the blob URL when it changes or unmounts. Doesn't touch React state,
  // so this is a "real" external-resource sync effect.
  React.useEffect(() => {
    if (!imagePreviewUrl?.startsWith("blob:")) return;
    return () => URL.revokeObjectURL(imagePreviewUrl);
  }, [imagePreviewUrl]);

  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  // Reset the form every time the dialog opens (false → true), regardless of
  // mode. Keying on `editingId` alone meant two consecutive "Add" clicks both
  // had key "new" and skipped the reset, so the form kept the just-saved
  // product's values.
  const [wasOpen, setWasOpen] = React.useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setCategory(editing?.category ?? "");
      setBrand(editing?.brand ?? "");
      setItemCode(editing?.itemCode ?? "");
      setBarcode(editing?.barcode ?? "");
      setItemDescription(editing?.itemDescription ?? "");
      setUom(editing?.uom ?? "");
      setWidthCm(editing?.itemDimensions ? String(editing.itemDimensions.widthMm / 10) : "");
      setHeightCm(editing?.itemDimensions ? String(editing.itemDimensions.heightMm / 10) : "");
      setDepthCm(
        editing?.itemDimensions?.depthMm !== undefined
          ? String(editing.itemDimensions.depthMm / 10)
          : "",
      );
      setImageFile(null);
      setImageRemoved(false);
      setErrors({});
      setSubmitting(false);
      setDeleting(false);
    }
  }

  function pickDimensions(): ItemDimensions | null {
    if (!widthCm && !heightCm) return null;
    const wCm = Number(widthCm);
    const hCm = Number(heightCm);
    if (!(Number.isFinite(wCm) && wCm > 0 && Number.isFinite(hCm) && hCm > 0)) return null;
    const dims: ItemDimensions = { widthMm: wCm * 10, heightMm: hCm * 10 };
    if (depthCm) {
      const dCm = Number(depthCm);
      if (Number.isFinite(dCm) && dCm > 0) dims.depthMm = dCm * 10;
    }
    return dims;
  }

  function validateLocal(): FieldErrors | null {
    const e: FieldErrors = {};
    if (!category.trim()) e.category = "Required";
    if (!brand.trim()) e.brand = "Required";
    if (!itemDescription.trim()) e.itemDescription = "Required";
    const someDimSet = widthCm || heightCm;
    const allDimsSet = widthCm && heightCm;
    if (someDimSet && !allDimsSet) e.dimensions = "Enter both width and height, or leave both blank.";
    if (allDimsSet) {
      if (!(Number(widthCm) > 0)) e.dimensions = "Width must be > 0";
      else if (!(Number(heightCm) > 0)) e.dimensions = "Height must be > 0";
    }
    if (depthCm && !(Number(depthCm) > 0)) {
      e.dimensions = "Depth must be > 0 (or leave blank)";
    }
    if (imageFile) {
      if (!ALLOWED_IMAGE_TYPES.includes(imageFile.type)) {
        e.image = "Use PNG / JPEG / WEBP / GIF / SVG";
      } else if (imageFile.size > 5 * 1024 * 1024) {
        e.image = "Image must be ≤ 5MB";
      }
    }
    return Object.keys(e).length === 0 ? null : e;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const localErrors = validateLocal();
    if (localErrors) {
      setErrors(localErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);

    const fd = new FormData();
    fd.set("category", category.trim());
    fd.set("brand", brand.trim());
    fd.set("itemCode", itemCode.trim());
    fd.set("barcode", barcode.trim());
    fd.set("itemDescription", itemDescription.trim());
    fd.set("uom", uom.trim());
    const dims = pickDimensions();
    if (dims) fd.set("itemDimensions", JSON.stringify(dims));
    if (imageFile) fd.set("image", imageFile);
    if (editing && imageRemoved && !imageFile) fd.set("imageRemoved", "1");

    const result = editing
      ? await updateTenantProduct(editing.productId, fd)
      : await createTenantProduct(fd);

    setSubmitting(false);

    if (!result.ok) {
      if (result.fieldErrors) setErrors(result.fieldErrors);
      toast.error(editing ? "Failed to update product" : "Failed to add product", {
        description: result.error,
      });
      return;
    }

    upsertProduct(result.product);
    toast.success(editing ? "Product updated" : "Product added", {
      description: result.product.itemDescription,
    });
    onClose();
  }

  async function onDelete() {
    if (!editing) return;
    if (!confirm(`Delete "${editing.itemDescription}"?`)) return;
    setDeleting(true);
    const r = await deleteTenantProduct(editing.productId);
    setDeleting(false);
    if (!r.ok) {
      toast.error("Failed to delete", { description: r.error });
      return;
    }
    removeProduct(editing.productId);
    toast.success("Product deleted");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !submitting && !deleting && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit product" : "Add product"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update product details. Changes save to your catalog."
              : "Adds a new item to your catalog."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="grid grid-cols-[1fr_180px] gap-5">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Category" required error={errors.category}>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Beverages"
                  autoFocus
                />
              </FormField>
              <FormField label="Brand" required error={errors.brand}>
                <Input
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="e.g. Coca-Cola"
                />
              </FormField>
            </div>

            <FormField label="Item description" required error={errors.itemDescription}>
              <Textarea
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                rows={2}
                placeholder="e.g. Coke Can 330ml"
              />
            </FormField>

            <div className="grid grid-cols-3 gap-3">
              <FormField label="UOM" hint="optional" error={errors.uom}>
                <Input value={uom} onChange={(e) => setUom(e.target.value)} placeholder="e.g. EA" />
              </FormField>
              <FormField label="Item code" hint="optional" error={errors.itemCode}>
                <Input
                  value={itemCode}
                  onChange={(e) => setItemCode(e.target.value)}
                  placeholder="SKU/code"
                />
              </FormField>
              <FormField label="Barcode" hint="optional" error={errors.barcode}>
                <Input
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="EAN/UPC"
                />
              </FormField>
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <Label>Dimensions (cm)</Label>
                <span className="text-[10px] text-slate-400">
                  width &amp; height together · depth optional
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={widthCm}
                  onChange={(e) => setWidthCm(e.target.value)}
                  placeholder="Width"
                />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  placeholder="Height"
                />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={depthCm}
                  onChange={(e) => setDepthCm(e.target.value)}
                  placeholder="Depth"
                />
              </div>
              {errors.dimensions ? (
                <p className="text-xs text-rose-600 mt-1">{errors.dimensions}</p>
              ) : null}
            </div>
          </div>

          {/* Image picker */}
          <div className="space-y-2">
            <Label>Image</Label>
            <ImagePicker
              previewUrl={imagePreviewUrl}
              onPickFile={(f) => {
                setImageFile(f);
                setImageRemoved(false);
              }}
              onClear={() => {
                setImageFile(null);
                setImageRemoved(true);
              }}
              error={errors.image}
            />
          </div>

          <DialogFooter className="col-span-2 flex !justify-between">
            <div>
              {editing ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={onDelete}
                  disabled={submitting || deleting}
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={submitting || deleting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={submitting || deleting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : editing ? (
                  "Save changes"
                ) : (
                  "Add product"
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FormField({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label>
          {label} {required ? <span className="text-rose-500">*</span> : null}
        </Label>
        {hint ? <span className="text-[10px] text-slate-400">{hint}</span> : null}
      </div>
      {children}
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

function ImagePicker({
  previewUrl,
  onPickFile,
  onClear,
  error,
}: {
  previewUrl: string | null;
  onPickFile: (f: File) => void;
  onClear: () => void;
  error?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPickFile(f);
          e.target.value = "";
        }}
      />
      <div className="aspect-square rounded-md border border-dashed border-slate-300 bg-slate-50 grid place-items-center overflow-hidden relative">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="preview" className="max-h-full max-w-full object-contain p-2" />
        ) : (
          <div className="flex flex-col items-center text-slate-400 text-xs gap-1">
            <ImagePlus className="h-6 w-6" />
            <span>No image</span>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => inputRef.current?.click()}
        >
          {previewUrl ? "Replace" : "Upload"}
        </Button>
        {previewUrl ? (
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            Remove
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </>
  );
}
