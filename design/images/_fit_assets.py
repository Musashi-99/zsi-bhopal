from PIL import Image
import os

src = r"C:\Users\krris\Documents\zsi bhopaal\design\images"
outs = [
    r"C:\Users\krris\Documents\zsi bhopaal\site\assets\img",
    r"C:\Users\krris\Documents\zsi bhopaal\honeychain-src\frontend\public\img",
]


def find(part):
    for f in os.listdir(src):
        if part.lower() in f.lower():
            return os.path.join(src, f)
    raise SystemExit("missing " + part)


def open_rgb(path):
    return Image.open(path).convert("RGB")


def cover(im, w, h, ax=0.5, ay=0.5):
    sw, sh = im.size
    scale = max(w / sw, h / sh)
    nw, nh = max(w, int(round(sw * scale))), max(h, int(round(sh * scale)))
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = max(0, min(nw - w, int(round((nw - w) * ax))))
    top = max(0, min(nh - h, int(round((nh - h) * ay))))
    return im.crop((left, top, left + w, top + h))


def region(im, box, w, h, ax=0.5, ay=0.5):
    sw, sh = im.size
    l, t, r, b = box
    crop = im.crop((int(l * sw), int(t * sh), int(r * sw), int(b * sh)))
    return cover(crop, w, h, ax, ay)


files = {}


def put(name, im):
    files[name] = im


S = 600
SCH = (800, 720)

basket = open_rgb(find("Rustic Woodland"))
harvest = open_rgb(find("Honey Harvest"))
portrait = open_rgb(find("PORTRAIT"))

put("honey.jpg", cover(open_rgb(find("honey-1.jpg")), S, S, 0.5, 0.48))
put("mahua.jpg", region(basket, (0.28, 0.00, 0.70, 0.40), S, S, 0.5, 0.35))
put("medicinal.jpg", region(basket, (0.00, 0.02, 0.46, 0.58), S, S, 0.35, 0.4))
put("seeds.jpg", region(basket, (0.55, 0.28, 0.99, 0.78), S, S, 0.55, 0.45))
put("ntfp.jpg", cover(basket, S, S, 0.5, 0.48))

put("honey-1.jpg", cover(open_rgb(find("honey-1.jpg")), S, S, 0.5, 0.5))
put("honey-2.jpg", cover(open_rgb(find("honey-2.jpg")), S, S))
put("honey-3.jpg", cover(open_rgb(find("honey-3.jpg")), S, S, 0.5, 0.55))
put("flower.jpg", cover(open_rgb(find("flower.jpg")), S, S, 0.5, 0.45))
put("forest.jpg", cover(open_rgb(find("fOREST.jpg")), S, S, 0.5, 0.55))
put("drying.jpg", cover(open_rgb(find("DRYING")), S, S, 0.45, 0.55))
put("packaging.jpg", cover(open_rgb(find("packeging")), S, S, 0.5, 0.42))

put("avatar.jpg", region(portrait, (0.10, 0.00, 0.90, 0.72), S, S, 0.5, 0.22))

hw, hh = harvest.size
tw, th = 1400, 520
crop_w = int(round(hh * tw / th))
left = max(0, hw - crop_w - 40)
promo = harvest.crop((left, 0, min(hw, left + crop_w), hh))
put("promo-hands.jpg", cover(promo, tw, th, 0.72, 0.5))

schemes = {
    "scheme-msp.jpg": "Rustic Woodland",
    "scheme-smftc.jpg": "Lush Saplings",
    "scheme-vandhan.jpg": "Women Sorting",
    "scheme-nap.jpg": "Nurtured Sapling",
    "scheme-nbhm.jpg": "Honigwabe",
    "scheme-pmjvm.jpg": "Reforestation",
    "scheme-pmksy.jpg": "Reservoir",
    "scheme-gim.jpg": "Lookout",
}
for name, part in schemes.items():
    put(name, cover(open_rgb(find(part)), SCH[0], SCH[1], 0.5, 0.45))

put("scheme-vd.jpg", files["scheme-vandhan.jpg"])
put("scheme-fra.jpg", files["scheme-gim.jpg"])
put("scheme-wb.jpg", files["scheme-msp.jpg"])

for name, im in files.items():
    for d in outs:
        im.save(os.path.join(d, name), "JPEG", quality=86, optimize=True, progressive=True)
    print(name, f"{im.size[0]}x{im.size[1]}")

print("count", len(files))
