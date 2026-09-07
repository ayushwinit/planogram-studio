"""
Batch background removal for product reference photos.

Input : rainbow_classes/<PRODUCT NAME>/ref.jpg
Output: rainbow_cutouts/<PRODUCT NAME>.png   (transparent background, cropped)

Usage:
    pip install "rembg[cli]" onnxruntime
    python scripts/remove_bg.py
    python scripts/remove_bg.py --src some_folder --out some_out --force
"""
import argparse
import sys
from pathlib import Path

from PIL import Image
from rembg import new_session, remove

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
MAX_BYTES = 5 * 1024 * 1024  # catalog upload limit
PAD_PX = 8


def find_source_image(folder: Path) -> Path | None:
    """Prefer a file literally named ref.*, else the first image in the folder."""
    for p in sorted(folder.iterdir()):
        if p.is_file() and p.stem.lower() == "ref" and p.suffix.lower() in IMAGE_EXTS:
            return p
    for p in sorted(folder.iterdir()):
        if p.is_file() and p.suffix.lower() in IMAGE_EXTS:
            return p
    return None


def trim_to_content(img: Image.Image) -> Image.Image:
    """Crop away fully transparent margins so the product fills the canvas.

    The editor scales every product image into its own mm-sized box, so leftover
    empty margin would shrink the product on the shelf.
    """
    box = img.getbbox()
    if not box:
        return img
    left, top, right, bottom = box
    return img.crop(
        (
            max(0, left - PAD_PX),
            max(0, top - PAD_PX),
            min(img.width, right + PAD_PX),
            min(img.height, bottom + PAD_PX),
        )
    )


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=str(root / "rainbow_classes"))
    ap.add_argument("--out", default=str(root / "rainbow_cutouts"))
    ap.add_argument("--model", default="isnet-general-use",
                    help="rembg model: isnet-general-use (sharper) or u2net")
    ap.add_argument("--force", action="store_true", help="redo files that already exist")
    args = ap.parse_args()

    src = Path(args.src)
    out = Path(args.out)
    if not src.is_dir():
        print(f"Source folder not found: {src}")
        return 1
    out.mkdir(parents=True, exist_ok=True)

    folders = sorted(p for p in src.iterdir() if p.is_dir())
    if not folders:
        print(f"No product subfolders inside {src}")
        return 1

    print(f"{len(folders)} products -> {out}")
    print(f"model: {args.model} (first run downloads it, ~180MB)\n")

    session = new_session(args.model)
    done = skipped = failed = 0

    for i, folder in enumerate(folders, 1):
        name = folder.name
        target = out / f"{name}.png"

        if target.exists() and not args.force:
            print(f"[{i:>2}/{len(folders)}] skip (exists)  {name}")
            skipped += 1
            continue

        source = find_source_image(folder)
        if source is None:
            print(f"[{i:>2}/{len(folders)}] NO IMAGE      {name}")
            failed += 1
            continue

        try:
            with Image.open(source) as im:
                cut = remove(im.convert("RGB"), session=session)
            cut = trim_to_content(cut.convert("RGBA"))
            cut.save(target, "PNG", optimize=True)
        except Exception as err:  # keep going; report at the end
            print(f"[{i:>2}/{len(folders)}] FAILED        {name}  ({err})")
            failed += 1
            continue

        size = target.stat().st_size
        warn = "  << over 5MB, shrink before upload" if size > MAX_BYTES else ""
        print(f"[{i:>2}/{len(folders)}] ok  {cut.width}x{cut.height}  {size/1024:6.0f}KB  {name}{warn}")
        done += 1

    print(f"\ndone={done} skipped={skipped} failed={failed}")
    print(f"output: {out}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
