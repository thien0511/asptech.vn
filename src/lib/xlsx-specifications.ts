import { inflateRawSync } from "node:zlib";

export type ParsedSpecification = {
  name: string;
  value: string;
  unit: string | null;
  sortOrder: number;
};

type ZipEntry = {
  name: string;
  compression: number;
  compressedSize: number;
  localHeaderOffset: number;
};

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

function clean(value: string) {
  return decodeXml(value).replace(/\s+/g, " ").trim();
}

function getAttribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function columnIndex(cellRef: string) {
  const letters = cellRef.match(/^[A-Z]+/i)?.[0].toUpperCase() ?? "A";
  let index = 0;
  for (const letter of letters) {
    index = index * 26 + (letter.charCodeAt(0) - 64);
  }
  return index - 1;
}

function readZipEntries(buffer: Buffer) {
  let eocdOffset = -1;
  const minOffset = Math.max(0, buffer.length - 66000);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("File Excel không hợp lệ: không tìm thấy ZIP directory.");

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries = new Map<string, ZipEntry>();

  let offset = centralDirectoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("File Excel không hợp lệ: central directory bị lỗi.");
    }
    const compression = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf-8");

    entries.set(name.replace(/\\/g, "/"), {
      name: name.replace(/\\/g, "/"),
      compression,
      compressedSize,
      localHeaderOffset,
    });

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function readZipFile(buffer: Buffer, entries: Map<string, ZipEntry>, name: string) {
  const entry = entries.get(name);
  if (!entry) return null;

  const offset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(offset) !== 0x04034b50) {
    throw new Error(`File Excel không hợp lệ: local header bị lỗi (${name}).`);
  }

  const fileNameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + fileNameLength + extraLength;
  const compressed = buffer.subarray(dataStart, dataStart + entry.compressedSize);

  if (entry.compression === 0) return compressed.toString("utf-8");
  if (entry.compression === 8) return inflateRawSync(compressed).toString("utf-8");
  throw new Error(`File Excel dùng kiểu nén chưa hỗ trợ (${entry.compression}).`);
}

function parseSharedStrings(xml: string | null) {
  if (!xml) return [];

  const strings: string[] = [];
  const siMatches = xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi);
  for (const siMatch of siMatches) {
    const textParts = [...siMatch[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)].map((match) => clean(match[1]));
    strings.push(textParts.join(""));
  }
  return strings;
}

function parseWorkbookSheets(workbookXml: string, relsXml: string | null) {
  const rels = new Map<string, string>();
  if (relsXml) {
    for (const match of relsXml.matchAll(/<Relationship\b[^>]*>/gi)) {
      const tag = match[0];
      const id = getAttribute(tag, "Id");
      const target = getAttribute(tag, "Target");
      if (id && target) {
        const normalizedTarget = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
        rels.set(id, normalizedTarget.replace(/\\/g, "/").replace(/\/\.\//g, "/"));
      }
    }
  }

  const sheets: Array<{ name: string; path: string }> = [];
  for (const match of workbookXml.matchAll(/<sheet\b[^>]*>/gi)) {
    const tag = match[0];
    const name = getAttribute(tag, "name");
    const relId = getAttribute(tag, "r:id");
    const path = rels.get(relId);
    if (name && path) sheets.push({ name, path });
  }

  return sheets;
}

function readCellValue(cellXml: string, sharedStrings: string[]) {
  const cellTag = cellXml.match(/<c\b[^>]*>/i)?.[0] ?? "";
  const type = getAttribute(cellTag, "t");

  if (type === "inlineStr") {
    return clean([...cellXml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)].map((match) => match[1]).join(""));
  }

  const value = cellXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i)?.[1];
  if (value === undefined) return "";
  if (type === "s") return sharedStrings[Number(value)] ?? "";
  return clean(value);
}

function parseSheetRows(sheetXml: string, sharedStrings: string[]) {
  const rows: string[][] = [];

  for (const rowMatch of sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gi)) {
    const row: string[] = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b[^>]*>[\s\S]*?<\/c>/gi)) {
      const cellXml = cellMatch[0];
      const cellTag = cellXml.match(/<c\b[^>]*>/i)?.[0] ?? "";
      const ref = getAttribute(cellTag, "r");
      const index = ref ? columnIndex(ref) : row.length;
      row[index] = readCellValue(cellXml, sharedStrings);
    }
    rows.push(row.map((value) => value ?? ""));
  }

  return rows;
}

function isHeaderRow(row: string[]) {
  const first = normalize(row[0] ?? "");
  const second = normalize(row[1] ?? "");
  return (
    ((first.includes("ten") && first.includes("thong so")) || first.includes("parameter") || first.includes("specification")) &&
    (second.includes("gia tri") || second.includes("value"))
  );
}

function firstDataRowIndex(rows: string[][]) {
  const headerIndex = rows.findIndex((row) => isHeaderRow(row));
  if (headerIndex >= 0) return headerIndex + 1;

  const firstTwoColumnRow = rows.findIndex((row) => clean(row[0] ?? "") && clean(row[1] ?? ""));
  return firstTwoColumnRow >= 0 ? firstTwoColumnRow : rows.length;
}

export function parseSpecificationsFromXlsxBuffer(buffer: Buffer) {
  const entries = readZipEntries(buffer);
  const workbookXml = readZipFile(buffer, entries, "xl/workbook.xml");
  if (!workbookXml) throw new Error("File Excel không hợp lệ: thiếu xl/workbook.xml.");

  const sharedStrings = parseSharedStrings(readZipFile(buffer, entries, "xl/sharedStrings.xml"));
  const sheets = parseWorkbookSheets(workbookXml, readZipFile(buffer, entries, "xl/_rels/workbook.xml.rels"));
  const specifications: ParsedSpecification[] = [];

  for (const sheet of sheets) {
    const sheetXml = readZipFile(buffer, entries, sheet.path);
    if (!sheetXml) continue;

    const rows = parseSheetRows(sheetXml, sharedStrings);
    const start = firstDataRowIndex(rows);

    for (const row of rows.slice(start)) {
      if (isHeaderRow(row)) continue;
      const name = clean(row[0] ?? "");
      const value = clean(row[1] ?? "");
      if (!name || !value) continue;

      specifications.push({
        name: name.slice(0, 255),
        value,
        unit: null,
        sortOrder: specifications.length + 1,
      });
    }
  }

  return specifications;
}

export async function parseSpecificationsFromXlsxFile(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return parseSpecificationsFromXlsxBuffer(buffer);
}
