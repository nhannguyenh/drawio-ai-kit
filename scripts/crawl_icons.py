#!/usr/bin/env python3.11
"""
crawl_icons.py — sinh/ xác thực catalog stencil draw.io từ nguồn chính thức.

Phân vai (theo thiết kế repo):
  - Node 26  : phục vụ AI (MCP server, CLI, validator)
  - Python 3.11: crawl & "cook" dữ liệu (catalog tên stencil + base64 icon OSS)

Chế độ:
  --mode names   (mặc định) Trích TÊN stencil mxgraph.aws4.* từ source draw.io
                 (ground-truth) -> hợp nhất vào catalog/aws.json, set incomplete=false.
  --mode base64  Crawl icon OSS/nội bộ (SVG) từ thư mục/URL -> catalog/custom-icons.json
                 dạng data URI base64 để nhúng shape=image vào draw.io.

Yêu cầu: Python 3.11+ (chỉ dùng thư viện chuẩn: urllib, json, base64, argparse, re).
"""
from __future__ import annotations

import argparse
import base64
import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "catalog" / "aws.json"
CUSTOM = ROOT / "catalog" / "custom-icons.json"

# Nguồn ground-truth: định nghĩa sidebar AWS4 của draw.io (Apache-2.0).
DRAWIO_AWS4_SOURCES = [
    "https://raw.githubusercontent.com/jgraph/drawio/dev/src/main/webapp/js/diagramly/sidebar/Sidebar-AWS4.js",
]

STENCIL_RE = re.compile(r"mxgraph\.aws4\.([a-z0-9_]+)")
GROUP_RE = re.compile(r"mxgraph\.aws4\.(group_[a-z0-9_]+)")
# bỏ qua các "shape word" không phải tên dịch vụ
SKIP = {"resourceIcon", "productIcon", "group", "groupCenter", "resourceIcon2"}


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "drawio-ai-kit/0.1"})
    with urllib.request.urlopen(req, timeout=30) as r:  # noqa: S310 (nguồn cố định, tin cậy)
        return r.read().decode("utf-8", errors="replace")


def crawl_names() -> dict:
    found: set[str] = set()
    groups: set[str] = set()
    errors: list[str] = []
    for url in DRAWIO_AWS4_SOURCES:
        try:
            txt = fetch(url)
        except Exception as e:  # noqa: BLE001
            errors.append(f"{url}: {e}")
            continue
        for m in STENCIL_RE.findall(txt):
            if m in SKIP:
                continue
            (groups if m.startswith("group_") else found).add(m)
    return {"icons": sorted(found), "groups": sorted(groups), "errors": errors}


def merge_names(dry_run: bool = False) -> None:
    data = json.loads(CATALOG.read_text(encoding="utf-8"))
    existing = {i["name"]: i for i in data.get("icons", [])}
    existing_g = {g["name"]: g for g in data.get("groups", [])}

    crawled = crawl_names()
    if crawled["errors"]:
        print("CẢNH BÁO khi crawl:", *crawled["errors"], sep="\n  ", file=sys.stderr)
    if not crawled["icons"]:
        print("Không trích được tên nào — kiểm tra mạng/URL nguồn.", file=sys.stderr)
        sys.exit(1)

    added = 0
    for name in crawled["icons"]:
        if name not in existing:
            existing[name] = {"name": name, "label": name, "category": "General",
                              "aliases": [], "keywords": name.split("_")}
            added += 1
    added_g = 0
    for name in crawled["groups"]:
        if name not in existing_g:
            existing_g[name] = {"name": name, "label": name, "stroke": "#232F3E", "dashed": False}
            added_g += 1

    data["icons"] = sorted(existing.values(), key=lambda x: x["name"])
    data["groups"] = sorted(existing_g.values(), key=lambda x: x["name"])
    data.setdefault("meta", {})
    data["meta"]["incomplete"] = False
    data["meta"]["source"] = "Đã hợp nhất từ jgraph/drawio Sidebar-AWS4.js (Apache-2.0)"

    print(f"Tổng icon: {len(data['icons'])} (+{added} mới), groups: {len(data['groups'])} (+{added_g} mới)")
    if dry_run:
        print("[dry-run] không ghi file.")
        return
    CATALOG.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Đã ghi {CATALOG}")
    print("Lưu ý: category/màu mặc định 'General' cho icon mới — bổ sung phân loại nếu cần.")


def crawl_base64(src: str) -> None:
    """Đọc các .svg trong thư mục `src`, mã hoá base64 -> custom-icons.json (data URI)."""
    srcdir = Path(src)
    if not srcdir.is_dir():
        print(f"Không phải thư mục: {src}", file=sys.stderr)
        sys.exit(1)
    out = {"meta": {"encoding": "data-uri-svg-base64",
                    "usage": "shape=image;image=<dataUri>;verticalLabelPosition=bottom;verticalAlign=top;"},
           "icons": []}
    for svg in sorted(srcdir.rglob("*.svg")):
        raw = svg.read_bytes()
        b64 = base64.b64encode(raw).decode("ascii")
        out["icons"].append({
            "name": svg.stem.lower().replace(" ", "_"),
            "label": svg.stem,
            "category": svg.parent.name,
            "dataUri": f"data:image/svg+xml;base64,{b64}",
        })
    CUSTOM.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Đã ghi {len(out['icons'])} icon base64 -> {CUSTOM}")
    print("LƯU Ý LICENSE: kiểm tra điều khoản trước khi redistribute icon bên thứ ba.")


def main() -> None:
    ap = argparse.ArgumentParser(description="Sinh/xác thực catalog stencil draw.io.")
    ap.add_argument("--mode", choices=["names", "base64"], default="names")
    ap.add_argument("--src", help="Thư mục chứa .svg (cho --mode base64).")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if args.mode == "names":
        merge_names(dry_run=args.dry_run)
    else:
        if not args.src:
            ap.error("--mode base64 cần --src <thư mục svg>")
        crawl_base64(args.src)


if __name__ == "__main__":
    main()
