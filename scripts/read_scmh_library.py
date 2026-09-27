"""Read-only inventory and text extraction for the local IAQG SCMH library."""

from __future__ import annotations

import argparse
import posixpath
import re
import zipfile
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree as ET

NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS_REL_DOC = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS_PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
NS_WORD = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS_DRAW = "http://schemas.openxmlformats.org/drawingml/2006/main"


def matches(root: Path, name: str, suffixes: set[str]) -> list[Path]:
    needle = name.casefold()
    return sorted(
        path
        for path in root.rglob("*")
        if path.is_file()
        and path.suffix.casefold() in suffixes
        and (not needle or needle in path.name.casefold())
    )


def inventory(root: Path) -> None:
    files = sorted(path for path in root.rglob("*") if path.is_file())
    print(f"library_file_count={len(files)}")
    print("extension_counts=" + ", ".join(
        f"{suffix or '[no extension]'}:{count}"
        for suffix, count in sorted(Counter(path.suffix.casefold() for path in files).items())
    ))
    print("folder_counts:")
    for folder, count in sorted(Counter(path.parent.relative_to(root).as_posix() for path in files).items()):
        print(f"  {folder}: {count}")
    print("files:")
    for path in files:
        print(f"  {path.relative_to(root).as_posix()}")


def parse_pages(spec: str, total: int) -> set[int]:
    if not spec:
        return set(range(1, total + 1))
    selected: set[int] = set()
    for part in spec.split(","):
        bounds = part.strip().split("-", 1)
        start = int(bounds[0])
        end = int(bounds[1]) if len(bounds) == 2 else start
        if start < 1 or end < start or end > total:
            raise SystemExit(f"Invalid page range {part!r} for a {total}-page PDF")
        selected.update(range(start, end + 1))
    return selected


def extract_pdfs(root: Path, name: str, page_spec: str) -> None:
    from pypdf import PdfReader

    files = matches(root, name, {".pdf"})
    if not files:
        raise SystemExit(f"No PDF name matched: {name!r}")
    for path in files:
        reader = PdfReader(str(path))
        selected_pages = parse_pages(page_spec, len(reader.pages))
        print(f"\n===== PDF {path.relative_to(root).as_posix()} | pages={len(reader.pages)} =====")
        for number, page in enumerate(reader.pages, 1):
            if number not in selected_pages:
                continue
            text = (page.extract_text() or "").strip()
            print(f"\n--- page {number} ---")
            print(text if text else "[no extractable text]")


def resolve_xlsx_target(target: str) -> str:
    target = target.replace("\\", "/")
    return target.lstrip("/") if target.startswith("/") else posixpath.normpath(posixpath.join("xl", target))


def extract_workbooks(root: Path, name: str) -> None:
    files = matches(root, name, {".xlsx", ".xlsm", ".xls"})
    if not files:
        raise SystemExit(f"No workbook name matched: {name!r}")
    for path in files:
        print(f"\n===== WORKBOOK {path.relative_to(root).as_posix()} =====")
        if path.suffix.casefold() == ".xls":
            print("[legacy .xls binary format; OOXML reader does not parse this file]")
            continue
        with zipfile.ZipFile(path) as archive:
            names = set(archive.namelist())
            workbook = ET.fromstring(archive.read("xl/workbook.xml"))
            relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
            rel_targets = {
                node.attrib["Id"]: resolve_xlsx_target(node.attrib["Target"])
                for node in relationships.findall(f"{{{NS_PKG_REL}}}Relationship")
            }
            shared_strings: list[str] = []
            if "xl/sharedStrings.xml" in names:
                shared_root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
                for item in shared_root.findall(f"{{{NS_MAIN}}}si"):
                    shared_strings.append("".join(node.text or "" for node in item.iter(f"{{{NS_MAIN}}}t")))
            sheet_nodes = workbook.find(f"{{{NS_MAIN}}}sheets")
            if sheet_nodes is None:
                continue
            for sheet in sheet_nodes:
                title = sheet.attrib.get("name", "[unnamed]")
                rel_id = sheet.attrib.get(f"{{{NS_REL_DOC}}}id", "")
                target = rel_targets.get(rel_id)
                if not target or target not in names:
                    print(f"\n--- sheet {title}: worksheet XML unavailable ---")
                    continue
                sheet_root = ET.fromstring(archive.read(target))
                print(f"\n--- sheet {title} ---")
                printed = 0
                for row in sheet_root.iter(f"{{{NS_MAIN}}}row"):
                    row_items: list[str] = []
                    for cell in row.findall(f"{{{NS_MAIN}}}c"):
                        ref = cell.attrib.get("r", "?")
                        kind = cell.attrib.get("t", "")
                        value_node = cell.find(f"{{{NS_MAIN}}}v")
                        formula_node = cell.find(f"{{{NS_MAIN}}}f")
                        inline_node = cell.find(f"{{{NS_MAIN}}}is")
                        value = value_node.text if value_node is not None else ""
                        if kind == "s" and value:
                            try:
                                value = shared_strings[int(value)]
                            except (IndexError, ValueError):
                                pass
                        elif kind == "inlineStr" and inline_node is not None:
                            value = "".join(node.text or "" for node in inline_node.iter(f"{{{NS_MAIN}}}t"))
                        formula = formula_node.text if formula_node is not None else ""
                        if value or formula:
                            cell_text = f"{ref}={value}"
                            if formula:
                                cell_text += f" [formula: {formula}]"
                            row_items.append(cell_text)
                    if row_items:
                        print(" | ".join(row_items))
                        printed += 1
                        if printed >= 300:
                            print("[row output truncated at 300 non-empty rows]")
                            break
            if "xl/vbaProject.bin" in names:
                print("[VBA project present; macros were not executed]")


def extract_office(root: Path, name: str) -> None:
    files = matches(root, name, {".docx", ".pptx"})
    if not files:
        raise SystemExit(f"No Word or PowerPoint name matched: {name!r}")
    for path in files:
        print(f"\n===== OFFICE {path.relative_to(root).as_posix()} =====")
        with zipfile.ZipFile(path) as archive:
            names = archive.namelist()
            if path.suffix.casefold() == ".docx":
                document = ET.fromstring(archive.read("word/document.xml"))
                paragraphs = document.findall(f".//{{{NS_WORD}}}p")
                for paragraph in paragraphs:
                    text = "".join(node.text or "" for node in paragraph.iter(f"{{{NS_WORD}}}t")).strip()
                    if text:
                        print(text)
            else:
                slide_paths = [item for item in names if re.fullmatch(r"ppt/slides/slide\d+\.xml", item)]
                slide_paths.sort(key=lambda item: int(re.search(r"slide(\d+)", item).group(1)))
                for number, slide_path in enumerate(slide_paths, 1):
                    slide = ET.fromstring(archive.read(slide_path))
                    items = []
                    for paragraph in slide.findall(f".//{{{NS_DRAW}}}p"):
                        text = "".join(node.text or "" for node in paragraph.iter(f"{{{NS_DRAW}}}t")).strip()
                        if text:
                            items.append(text)
                    print(f"--- slide {number} ---")
                    print("\n".join(items))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--mode", choices=("inventory", "pdf", "workbook", "office"), required=True)
    parser.add_argument("--name", default="")
    parser.add_argument("--pages", default="")
    args = parser.parse_args()
    if args.mode == "inventory":
        inventory(args.root)
    elif args.mode == "pdf":
        extract_pdfs(args.root, args.name, args.pages)
    elif args.mode == "workbook":
        extract_workbooks(args.root, args.name)
    else:
        extract_office(args.root, args.name)


if __name__ == "__main__":
    main()
