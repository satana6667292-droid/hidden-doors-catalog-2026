#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, re
from pathlib import Path

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--site", required=True)
    args=ap.parse_args()
    path=Path(args.site)/"catalog-data.js"
    raw=path.read_text(encoding="utf-8")
    m=re.match(r"\s*window\.CATALOG_DATA\s*=\s*(\{.*\})\s*;\s*$", raw, re.S)
    if not m:
        raise SystemExit("CATALOG DATA PATCH: unsupported catalog-data.js format")
    data=json.loads(m.group(1))
    pages=data.get("pages", [])
    by={int(p.get("physicalIndex", p.get("id", 0))): p for p in pages}

    def upsert(n, label, title):
        p=by.get(n)
        payload={
            "physicalIndex": n,
            "label": label,
            "title": title,
            "status": "approved",
            "statusText": "Согласовано",
            "image": f"assets/pages/page-{n:03d}.webp",
            "thumb": f"assets/thumbs/page-{n:03d}.webp",
            "locked": True,
        }
        if p is None:
            pages.append(payload)
            by[n]=pages[-1]
        else:
            p.update(payload)

    upsert(43, "42", "Контакты / каталог / конфигуратор")
    upsert(44, "43", "Финальная имиджевая страница")
    upsert(45, "44", "Задняя обложка")

    pages.sort(key=lambda p: int(p.get("physicalIndex", p.get("id", 0))))
    data["pages"]=pages

    # Keep base/editor metadata aware of the standalone back cover too.
    spreads=data.get("spreads")
    if isinstance(spreads, list) and not any(
        45 in (s.get("left"), s.get("right")) for s in spreads if isinstance(s, dict)
    ):
        spreads.append({"id":"back-cover-45","left":45,"right":None,"type":"cover"})

    path.write_text(
        "window.CATALOG_DATA = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8"
    )
    print(f"CATALOG DATA PATCH: {len(pages)} physical pages; 43-45 approved, page 45 appended.")

if __name__=="__main__":
    main()
