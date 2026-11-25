"""Generate an animated kaleidoscope pattern video (MP4) using numpy + ffmpeg.

Usage: python3 make_video.py [output.mp4] [seconds]
"""
import subprocess
import sys

import numpy as np

W = H = 720
FPS = 30
OUT = sys.argv[1] if len(sys.argv) > 1 else "pattern.mp4"
SECONDS = float(sys.argv[2]) if len(sys.argv) > 2 else 12

y, x = np.mgrid[-1:1:H * 1j, -1:1:W * 1j]
r = np.hypot(x, y)
theta = np.arctan2(y, x)
SEGMENTS = 8


def frame(t: float) -> np.ndarray:
    # Kaleidoscope folding of the angle
    seg = 2 * np.pi / SEGMENTS
    a = np.abs((theta + t * 0.3) % seg - seg / 2)
    u = r * np.cos(a) * 6
    v = r * np.sin(a) * 6

    # Layered interference waves
    f = (np.sin(u + t * 1.7)
         + np.sin(v * 1.3 - t * 1.1)
         + np.sin((u + v) * 0.7 + t)
         + np.sin(r * 10 - t * 3))
    f = f / 4

    # Cycling palette
    hue = f * 2.0 + t * 0.4 + r * 1.5
    rch = 0.5 + 0.5 * np.sin(2 * np.pi * (hue + 0.00))
    gch = 0.5 + 0.5 * np.sin(2 * np.pi * (hue + 0.33))
    bch = 0.5 + 0.5 * np.sin(2 * np.pi * (hue + 0.67))

    # Glowing line bands + vignette
    glow = 1 - np.clip(np.abs(np.sin(f * np.pi * 3)) * 1.6, 0, 1)
    vignette = np.clip(1.25 - r * 0.75, 0, 1)
    img = np.stack([rch, gch, bch], axis=-1)
    img = (img * 0.75 + glow[..., None] * 0.45) * vignette[..., None]

    # Fade in / out
    fade = min(1.0, t / 1.0, (SECONDS - t) / 1.0)
    return (np.clip(img * fade, 0, 1) * 255).astype(np.uint8)


def main() -> None:
    proc = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
         "-i", "-",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20",
         "-movflags", "+faststart", OUT],
        stdin=subprocess.PIPE,
    )
    n = int(SECONDS * FPS)
    for i in range(n):
        proc.stdin.write(frame(i / FPS).tobytes())
    proc.stdin.close()
    proc.wait()
    print(f"Wrote {OUT} ({n} frames, {SECONDS}s @ {FPS}fps)")


if __name__ == "__main__":
    main()
