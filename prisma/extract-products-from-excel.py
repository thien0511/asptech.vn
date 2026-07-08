import json
from pathlib import Path
from datetime import datetime, date

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
EXCEL_PATH = ROOT.parent / "Danh_muc_san_pham_2026-06-30_grouped.xlsx"
OUTPUT_PATH = ROOT / "prisma" / "products-import.json"


def clean(value):
    if value is None:
        return None
    if isinstance(value, str):
        value = value.strip()
        return value or None
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


workbook = openpyxl.load_workbook(EXCEL_PATH, read_only=True, data_only=True)
sheet = workbook.active
rows = list(sheet.iter_rows(values_only=True))
headers = [str(value).strip() for value in rows[0]]
records = []

for row in rows[1:]:
    if not any(value is not None for value in row):
        continue
    record = dict(zip(headers, row))
    records.append(
        {
            "legacyExcelStt": clean(record.get("STT")),
            "name": clean(record.get("Tên")),
            "description": clean(record.get("Mô tả")),
            "supplierName": clean(record.get("Nhà cung cấp")),
            "manufacturerName": clean(record.get("Nhà sản xuất")),
            "manufacturerCountry": clean(record.get("Nước sản xuất")),
            "sourceDocumentFolder": clean(record.get("Thư mục tài liệu")),
            "sourceWebsite": clean(record.get("Trang Web")),
            "sourceUpdatedAt": clean(record.get("Ngày cập nhật")),
            "model": clean(record.get("Model")),
            "summary": clean(record.get("Tóm tắt")),
            "contactPerson": clean(record.get("Liên hệ")),
            "groupName": clean(record.get("Nhóm")),
            "sourceImageSpecFolder": clean(record.get("Thư mục hình ảnh và thông số")),
        }
    )

OUTPUT_PATH.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Wrote {len(records)} product records to {OUTPUT_PATH}")
