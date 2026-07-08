import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ContentStatus, Visibility } from "../src/generated/prisma/client";

type ProductImportRow = {
  legacyExcelStt: number;
  name: string;
  description: string;
  supplierName: string;
  manufacturerName: string;
  manufacturerCountry: string;
  sourceDocumentFolder: string;
  sourceWebsite: string;
  sourceUpdatedAt: string;
  model: string;
  summary: string;
  contactPerson: string;
  groupName: string;
  sourceImageSpecFolder: string;
};

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not configured");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

async function uniqueSlug(base: string, existingProductId?: string) {
  let slug = base;
  let counter = 2;

  while (true) {
    const existing = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (!existing || existing.id === existingProductId) return slug;
    slug = `${base}-${counter}`;
    counter += 1;
  }
}

async function uniqueCode(base: string, existingProductId?: string) {
  let code = base;
  let counter = 2;

  while (true) {
    const existing = await prisma.product.findUnique({ where: { code }, select: { id: true } });
    if (!existing || existing.id === existingProductId) return code;
    code = `${base}-${counter}`;
    counter += 1;
  }
}

async function main() {
  const raw = await readFile(new URL("./products-import.json", import.meta.url), "utf-8");
  const rows = JSON.parse(raw) as ProductImportRow[];

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const groupSlug = slugify(row.groupName);
    const group = await prisma.productGroup.upsert({
      where: { name: row.groupName },
      update: { slug: groupSlug },
      create: { name: row.groupName, slug: groupSlug },
    });

    const manufacturer = await prisma.manufacturer.upsert({
      where: { name: row.manufacturerName },
      update: {
        country: row.manufacturerCountry,
        website: row.sourceWebsite,
      },
      create: {
        name: row.manufacturerName,
        country: row.manufacturerCountry,
        website: row.sourceWebsite,
      },
    });

    const existing = await prisma.product.findFirst({
      where: {
        model: row.model,
        manufacturerId: manufacturer.id,
      },
      select: { id: true },
    });

    const slugBase = slugify(row.name);
    const codeBase = slugify(row.model).toUpperCase();
    const slug = await uniqueSlug(slugBase, existing?.id);
    const code = await uniqueCode(codeBase, existing?.id);

    const data = {
      code,
      slug,
      name: row.name,
      model: row.model,
      summary: row.summary,
      description: row.description,
      supplierName: row.supplierName,
      contactPerson: row.contactPerson,
      sourceWebsite: row.sourceWebsite,
      sourceDocumentFolder: row.sourceDocumentFolder,
      sourceImageSpecFolder: row.sourceImageSpecFolder,
      sourceUpdatedAt: parseDate(row.sourceUpdatedAt),
      legacyExcelStt: Number(row.legacyExcelStt),
      status: ContentStatus.DRAFT,
      visibility: Visibility.INTERNAL,
      featured: false,
      groupId: group.id,
      manufacturerId: manufacturer.id,
    };

    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data });
      updated += 1;
    } else {
      await prisma.product.create({ data });
      created += 1;
    }
  }

  await prisma.auditEvent.create({
    data: {
      action: "PRODUCT_IMPORT_EXCEL",
      entity: "Product",
      result: "SUCCESS",
      metadata: { source: "Danh_muc_san_pham_2026-06-30_grouped.xlsx", rows: rows.length, created, updated },
    },
  });

  console.log(JSON.stringify({ rows: rows.length, created, updated }, null, 2));
}

main()
  .catch(async (error) => {
    console.error(error);
    await prisma.auditEvent.create({
      data: {
        action: "PRODUCT_IMPORT_EXCEL",
        entity: "Product",
        result: "FAILURE",
        metadata: { error: error instanceof Error ? error.message : String(error) },
      },
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
