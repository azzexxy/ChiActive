"""Unpack every .zip in designs/ into designs/website-design-<name>/ and list it in manifest.json."""
import json, os, re, sys, unicodedata, zipfile, datetime
from pathlib import PurePosixPath

DIR = "designs"
ALLOWED = {"html", "htm", "css", "js", "mjs", "json", "map", "txt", "md", "xml", "csv", "svg", "png", "jpg", "jpeg",
           "gif", "webp", "avif", "ico", "bmp", "woff", "woff2", "ttf", "otf", "eot", "mp4", "webm", "mp3", "wav", "ogg", "pdf"}
JUNK = re.compile(r"(^|/)(__MACOSX|\.DS_Store|Thumbs\.db|desktop\.ini|\.git|node_modules)(/|$)|(^|/)\._", re.I)
MAX_TOTAL = 60 * 1024 * 1024

def slugify(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:50] or "student"

def safe(p):
    p = p.replace("\\", "/").lstrip("/")
    if not p or JUNK.search(p): return None
    parts = p.split("/")
    if any(not x or x in (".", "..") or x.startswith(".") for x in parts): return None
    if p.rsplit(".", 1)[-1].lower() not in ALLOWED: return None
    return "/".join(parts)

manifest_path = os.path.join(DIR, "manifest.json")
try:
    manifest = json.load(open(manifest_path))
    if not isinstance(manifest, list): manifest = []
except Exception:
    manifest = []

zips = [os.path.join(DIR, f) for f in sorted(os.listdir(DIR)) if f.lower().endswith(".zip")] if os.path.isdir(DIR) else []
for zpath in zips:
    student = re.sub(r"[-_]+", " ", os.path.splitext(os.path.basename(zpath))[0]).strip()
    student = re.sub(r"^(website\s*design\s*-?\s*)", "", student, flags=re.I).strip() or "Student"
    try:
        zf = zipfile.ZipFile(zpath)
    except zipfile.BadZipFile:
        print(f"::warning::{zpath} is not a valid zip; leaving it"); continue
    entries = [i for i in zf.infolist() if not i.is_dir() and not JUNK.search(i.filename)]
    names = [i.filename.replace("\\", "/") for i in entries]
    tops = {n.split("/")[0] for n in names}
    strip = (list(tops)[0] + "/") if len(tops) == 1 and all("/" in n for n in names) else ""
    files, total = [], 0
    for info, name in zip(entries, names):
        rel = safe(name[len(strip):])
        if not rel: continue
        total += info.file_size
        if total > MAX_TOTAL: break
        files.append((rel, info))
    html = [f for f, _ in files if re.search(r"\.html?$", f, re.I)]
    if not html or total > MAX_TOTAL:
        print(f"::warning::{zpath}: no web page found or too big; leaving it"); continue
    idx = sorted([f for f in html if re.search(r"(^|/)index\.html?$", f, re.I)], key=lambda p: p.count("/"))
    entry = idx[0] if idx else sorted(html, key=lambda p: (p.count("/"), p))[0]
    base = "website-design-" + slugify(student)
    folder, n = base, 2
    while os.path.exists(os.path.join(DIR, folder)):
        folder, n = f"{base}-{n}", n + 1
    for rel, info in files:
        out = os.path.join(DIR, folder, *PurePosixPath(rel).parts)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        with zf.open(info) as src, open(out, "wb") as dst: dst.write(src.read())
    name = f"Website design - {student}" + ("" if folder == base else f" ({folder[len(base) + 1:]})")
    manifest.append({"folder": folder, "name": name, "by": student, "entry": entry,
                     "uploadedAt": datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"})
    zf.close(); os.remove(zpath)
    print(f"Unpacked {zpath} -> {DIR}/{folder} ({len(files)} files, starts at {entry})")

with open(manifest_path, "w") as fh:
    json.dump(manifest, fh, indent=2); fh.write("\n")
