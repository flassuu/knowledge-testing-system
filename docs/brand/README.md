# LANtern — brand assets (placeholder)

Placeholder artwork for **LANtern** — a lantern on a LAN, because the system is a
light in a classroom with no internet. Nothing here is final: the files are the
*formats* the product needs, filled with stand-in geometry so every surface
already looks deliberate. Replace the two SVGs and re-run the export command.

| File | What it is |
|------|------------|
| `lantern-mark.svg` | The bare mark, no background. Used in the app header and anywhere the surface shows through. |
| `lantern-app-icon.svg` | The mark inside a filled rounded square — what launchers want. |
| `lantern-logo.svg` | Mark + wordmark lockup for the site header and the README. |

## Where each format is used

**Web client** — `apps/web-client/public/`

| File | Size | Used by |
|------|------|---------|
| `favicon.svg` | vector | Modern browsers, dark/light aware |
| `favicon.ico` | 16 + 32 + 48 | Every browser that is not modern; bookmarks, tabs |
| `icon-192.png` | 192×192 | PWA manifest (Phase 6) |
| `icon-512.png` | 512×512 | PWA splash, share cards, install prompts |
| `icon-maskable-512.png` | 512×512, art inside the safe circle | Android adaptive icons |
| `apple-touch-icon.png` | 180×180 | iOS "Add to Home Screen" |

**Desktop (Tauri 2)** — `apps/desktop/src-tauri/icons/`

| File | Size | Notes |
|------|------|-------|
| `32x32.png` | 32×32 | Taskbar, file list |
| `128x128.png` | 128×128 | Installer, Explorer |
| `128x128@2x.png` | 256×256 | macOS/Linux HiDPI |
| `icon.icns` | multi-size | macOS bundle |
| `icon.ico` | 16/32/48/256 | Windows, `.exe` and `.msi` |

## Exporting after an artwork change

```bash
cd docs/brand

# Web: vector favicon, then the raster sizes
cp lantern-app-icon.svg ../apps/web-client/public/favicon.svg
for size in 16 32 48; do
  rsvg-convert -w "$size" -h "$size" lantern-app-icon.svg -o /tmp/icon-$size.png
done
magick /tmp/icon-16.png /tmp/icon-32.png /tmp/icon-48.png \
  ../apps/web-client/public/favicon.ico   # ImageMagick 7; `convert` works too

for size in 180 192 512; do
  name=$(case $size in 180) echo apple-touch-icon.png ;; 192) echo icon-192.png ;; *) echo icon-512.png ;; esac)
  rsvg-convert -w "$size" -h "$size" lantern-app-icon.svg -o "../apps/web-client/public/$name"
done

# Maskable: same art, scaled to 60% and centred, so a circular mask cannot clip it
rsvg-convert -w 512 -h 512 lantern-app-icon.svg -o /tmp/maskable.png
magick /tmp/maskable.png -resize 307x307 -background none -gravity center -extent 512x512 \
  ../apps/web-client/public/icon-maskable-512.png

# Desktop: Tauri expects these exact names
I=../apps/desktop/src-tauri/icons
rsvg-convert -w 32   -h 32   lantern-app-icon.svg -o "$I/32x32.png"
rsvg-convert -w 128  -h 128  lantern-app-icon.svg -o "$I/128x128.png"
rsvg-convert -w 256  -h 256  lantern-app-icon.svg -o "$I/128x128@2x.png"
magick "$I/32x32.png" "$I/128x128.png" "$I/128x128@2x.png" "$I/icon.ico"
python3 scripts/make_icns.py "$I"     # writes icon.icns from the PNGs
```

## Rules the artwork has to respect

- **Legible at 16px.** At that size the LAN nodes turn to noise; the lantern and
  the glow are the mark.
- **One warm accent.** The whole UI is cool (indigo on neutral surfaces); the
  lantern is the only warm thing on screen, so it reads as the light source.
- **No emoji, no raster text.** The lockup's wordmark is set in text here only as
  a placeholder — the final one has to be outlined, or it renders differently on
  every machine.
- **Contrast.** The mark sits on `--surface-container` in the app and on the
  indigo field in the launcher icon; both are checked against the theme tokens in
  `apps/web-client/src/theme.css`.