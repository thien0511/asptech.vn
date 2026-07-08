import json
import os
import re
import shutil
import sys
from pathlib import Path

import openpyxl


IMAGE_RE = re.compile(r"^image(\d*)\.png$", re.IGNORECASE)


def clean_cell(value):
    if value is None:
        return ""
    text = str(value).strip()
    return re.sub(r"\s+", " ", text)


def parse_spec_workbook(path):
    workbook = openpyxl.load_workbook(path, data_only=True, read_only=True)
    worksheet = workbook.active
    specs = []

    for row in worksheet.iter_rows(values_only=True):
        cells = [clean_cell(value) for value in row]
        non_empty = [cell for cell in cells if cell]
        if len(non_empty) < 2:
            continue

        name = non_empty[0]
        value = non_empty[1]
        unit = non_empty[2] if len(non_empty) >= 3 else None

        normalized_name = name.casefold()
        normalized_value = value.casefold()
        if normalized_name in {"tên thông số", "ten thong so", "parameter", "specification"} and normalized_value in {
            "giá trị",
            "gia tri",
            "value",
        }:
            continue

        specs.append(
            {
                "name": name[:255],
                "value": value,
                "unit": unit[:64] if unit else None,
                "sortOrder": len(specs) + 1,
            }
        )

    return specs


def image_sort_key(path):
    match = IMAGE_RE.match(path.name)
    if not match:
        return (999999, path.name.casefold())
    number = match.group(1)
    return (int(number) if number else 0, path.name.casefold())


def main():
    if len(sys.argv) != 5:
        raise SystemExit(
            "Usage: extract-product-media.py <source-json> <workspace-root> <public-root> <output-json>"
        )

    source_json = Path(sys.argv[1])
    workspace_root = Path(sys.argv[2])
    public_root = Path(sys.argv[3])
    output_json = Path(sys.argv[4])

    products = json.loads(source_json.read_text(encoding="utf-8"))
    results = []

    for product in products:
        folder_value = (product.get("sourceImageSpecFolder") or "").strip()
        if not folder_value:
            results.append({**product, "folderExists": False, "assets": [], "specifications": []})
            continue

        folder_path = Path(folder_value)
        if not folder_path.is_absolute():
            folder_path = workspace_root / folder_value

        folder_exists = folder_path.exists() and folder_path.is_dir()
        assets = []
        specifications = []

        if folder_exists:
            asset_dir = public_root / "product-assets" / product["id"]
            asset_dir.mkdir(parents=True, exist_ok=True)

            for image_path in sorted(folder_path.iterdir(), key=image_sort_key):
                if not image_path.is_file() or not IMAGE_RE.match(image_path.name):
                    continue

                destination = asset_dir / image_path.name
                shutil.copy2(image_path, destination)
                assets.append(
                    {
                        "title": image_path.stem,
                        "storageKey": f"/product-assets/{product['id']}/{image_path.name}",
                        "fileName": image_path.name,
                        "mimeType": "image/png",
                        "size": destination.stat().st_size,
                    }
                )

            spec_path = folder_path / "thong_so.xlsx"
            if spec_path.exists() and spec_path.is_file():
                specifications = parse_spec_workbook(spec_path)

        results.append(
            {
                **product,
                "folderPath": str(folder_path),
                "folderExists": folder_exists,
                "assets": assets,
                "specifications": specifications,
            }
        )

    output_json.parent.mkdir(parents=True, exist_ok=True)
    output_json.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")

    summary = {
        "products": len(results),
        "foldersFound": sum(1 for item in results if item["folderExists"]),
        "assets": sum(len(item["assets"]) for item in results),
        "specifications": sum(len(item["specifications"]) for item in results),
        "missingFolders": sum(1 for item in results if not item["folderExists"]),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
