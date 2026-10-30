"""Paper Fig. 3: dock sites of each strategy over the stage-0 and stage-12 flood (heavy weather)."""
import json
import os
import sys
from pathlib import Path

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt                       # noqa: E402

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from select_hubs import display_image, CORE           # noqa: E402  (also puts adapt_core on sys.path)
import cv2                                            # noqa: E402
from src.vision.image_processing import ImageProcessor  # noqa: E402

FIG = HERE.parent / "paper" / "figures"
SHOW = {"robust6": ("s", "#0b7a75", "Robust docks (6)"), "event": ("^", "#c26a00", "Event-sited docks"),
        "uniform6": ("D", "#555555", "Uniform docks (6)")}


def flood(image, grow):
    proc = ImageProcessor()
    proc.sample_points = proc.auto_sample_points(image)
    proc.image = image.copy()
    proc.compute_dynamic_hsv()
    m = proc.mask_flood_areas(image)
    if m.ndim == 3:
        m = cv2.cvtColor(m, cv2.COLOR_BGR2GRAY)
    if grow:
        m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * grow + 1, 2 * grow + 1)))
    return m > 0


def main():
    avail = json.loads((HERE / "availability.json").read_text())
    plt.rcParams.update({"font.family": "Liberation Sans", "font.size": 7})
    fig, axes = plt.subplots(1, 2, figsize=(3.45, 2.42))            # one IEEE column
    for ax, city in zip(axes, ("varanasi", "kanpur")):
        img = display_image(city)
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(float) / 255
        grey = np.repeat(rgb.mean(axis=2, keepdims=True), 3, axis=2) * 0.55 + 0.45   # washed-out basemap
        f0, f12 = flood(img, 0), flood(img, 12)
        grey[f12 & ~f0] = (0.62, 0.78, 0.92)
        grey[f0] = (0.12, 0.38, 0.70)
        ax.imshow(grey)
        usable = {tuple(p) for p in avail[city]["g12_heavy"]}
        for s, (mk, col, lab) in SHOW.items():
            hubs = json.loads((HERE / "hubs" / f"{city}_{s}.json").read_text())
            for i, (x, y) in enumerate(hubs):
                ok = (x, y) in usable
                ax.scatter([x], [y], marker=mk, s=24, facecolor=col if ok else "white", edgecolor=col, lw=1.1,
                           zorder=3)
        ax.set_title(city.title(), fontsize=8, fontweight="bold", loc="left", pad=3)
        ax.set_xticks([]); ax.set_yticks([])
        for sp in ax.spines.values():
            sp.set_color("#888")
    from matplotlib.lines import Line2D
    from matplotlib.patches import Patch
    handles = [Line2D([], [], ls="", marker=mk, ms=5, mfc=col, mec=col, mew=1.1) for mk, col, _ in SHOW.values()]
    labels = [lab for _, _, lab in SHOW.values()]
    handles += [Patch(color=(0.12, 0.38, 0.70)), Patch(color=(0.62, 0.78, 0.92))]
    labels += ["Flood, stage 0", "Added water, stage 12"]
    fig.legend(handles, labels, loc="lower center", ncol=3, fontsize=6.3, frameon=False, columnspacing=1.0, handletextpad=0.3, bbox_to_anchor=(0.5, 0.05))
    fig.text(0.5, 0.012, "Hollow marker: dock unusable at stage 12, heavy weather", ha="center", fontsize=6.2, color="#444")
    fig.tight_layout(rect=(0, 0.19, 1, 0.99), w_pad=0.4)
    fig.savefig(FIG / "fig3_dock_maps.png", dpi=300)


if __name__ == "__main__":
    main()
