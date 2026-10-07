"""Writes a macOS .icns from the PNG sizes already in apps/desktop/src-tauri/icons.

ICNS is a small container format: an 'icns' header, then one chunk per size,
each a four-character type, a big-endian length and the image bytes. PNG-backed
types are what every current macOS expects.
"""
import pathlib
import struct
import sys

ICONS = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'apps/desktop/src-tauri/icons')

# (chunk type, source file, width)
CHUNKS = [
    ('icp4', '32x32.png', 16),
    ('icp5', '32x32.png', 32),
    ('ic07', '128x128.png', 128),
    ('ic08', '128x128@2x.png', 256),
    ('ic09', '128x128@2x.png', 512),
]


def chunk(kind: str, data: bytes) -> bytes:
    return kind.encode('ascii') + struct.pack('>I', len(data) + 8) + data


def main() -> None:
    body = b''
    for kind, name, width in CHUNKS:
        source = ICONS / name
        if not source.exists():
            print(f'пропущено {kind}: нет {source}')
            continue
        data = source.read_bytes()
        body += chunk(kind, data)
        print(f'{kind}: {width}px из {name} ({len(data)} байт)')

    target = ICONS / 'icon.icns'
    target.write_bytes(b'icns' + struct.pack('>I', len(body) + 8) + body)
    print(f'записан {target} ({target.stat().st_size} байт)')


main()