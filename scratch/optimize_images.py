import os
from PIL import Image

def convert_to_webp(png_path, webp_path, quality=80):
    if not os.path.exists(png_path):
        print(f"File not found: {png_path}")
        return False
    try:
        size_before = os.path.getsize(png_path)
        with Image.open(png_path) as img:
            # Save as webp
            img.save(webp_path, "WEBP", quality=quality, method=6)
        size_after = os.path.getsize(webp_path)
        print(f"[OK] Converted {os.path.basename(png_path)} -> {os.path.basename(webp_path)}")
        print(f"  Size: {size_before/1024:.1f} KB -> {size_after/1024:.1f} KB (Saved {(size_before - size_after)/1024:.1f} KB)")
        # Delete original
        os.remove(png_path)
        return True
    except Exception as e:
        print(f"[FAIL] Failed to convert {png_path}: {e}")
        return False

base_dir = "artifacts/chord-app"

images = [
    # Drum kits
    ("public/kit-bright.png", "public/kit-bright.webp"),
    ("public/kit-punchy.png", "public/kit-punchy.webp"),
    ("public/kit-warm.png", "public/kit-warm.webp"),
    ("public/kit-soft.png", "public/kit-soft.webp"),
    ("public/kit-house.png", "public/kit-house.webp"),
    # Instruments
    ("public/instruments/guitar.png", "public/instruments/guitar.webp"),
    ("public/instruments/piano.png", "public/instruments/piano.webp"),
    ("public/instruments/bass.png", "public/instruments/bass.webp"),
    ("public/instruments/ukulele.png", "public/instruments/ukulele.webp"),
    # Icons
    ("public/stage-core/icons/outlet.png", "public/stage-core/icons/outlet.webp"),
]

for src, dest in images:
    src_full = os.path.join(base_dir, src)
    dest_full = os.path.join(base_dir, dest)
    convert_to_webp(src_full, dest_full)
