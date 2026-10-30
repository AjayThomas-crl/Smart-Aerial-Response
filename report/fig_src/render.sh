#!/usr/bin/env bash
# Render report/fig_src/<name>.html to report/figures/<name>.png at device scale 2, trimming trailing white.
cd "$(dirname "$0")"
for f in "${@:-*.html}"; do
  n=$(basename "$f" .html)
  chromium --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --window-size=1100,1600 \
    --screenshot="../figures/$n.png" "file://$PWD/$n.html" >/dev/null 2>&1
  python3 - "../figures/$n.png" <<'PY'
import sys
from PIL import Image, ImageChops
p = sys.argv[1]; im = Image.open(p).convert("RGB")
box = ImageChops.difference(im, Image.new("RGB", im.size, "white")).getbbox()
im = im.crop((0, 0, im.width, min(im.height, box[3] + 30))); im.save(p)
print(p, im.size)
PY
done
