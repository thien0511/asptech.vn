import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { ContentStatus, PrismaClient, Visibility } from "../src/generated/prisma/client";

type ProductImportRow = {
  name: string;
  description: string;
  contactPerson?: string;
  groupName: string;
};

type ProductMediaSourceRow = {
  id: string;
  name: string;
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

async function uniqueSlug(base: string, existingProductId?: string) {
  let slug = base || "san-pham";
  let counter = 2;

  while (true) {
    const existing = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (!existing || existing.id === existingProductId) return slug;
    slug = `${base || "san-pham"}-${counter}`;
    counter += 1;
  }
}

async function main() {
  const raw = await readFile(new URL("./products-import.json", import.meta.url), "utf-8");
  const rows = JSON.parse(raw) as ProductImportRow[];
  const productIdsByName = await readProductIdsByName();

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const groupSlug = slugify(row.groupName);
    const group = await prisma.productGroup.upsert({
      where: { name: row.groupName },
      update: { slug: groupSlug },
      create: { name: row.groupName, slug: groupSlug },
    });

    const sourceProductId = productIdsByName.get(row.name);
    const existingById = sourceProductId
      ? await prisma.product.findUnique({ where: { id: sourceProductId }, select: { id: true } })
      : null;
    const existing =
      existingById ??
      (await prisma.product.findFirst({
        where: {
          name: row.name,
          groupId: group.id,
        },
        select: { id: true },
      }));

    const slug = await uniqueSlug(slugify(row.name), existing?.id);
    const baseData = {
      slug,
      name: row.name,
      description: row.description,
      contactPerson: row.contactPerson?.trim() || null,
      groupId: group.id,
    };

    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data: baseData });
      updated += 1;
    } else {
      await prisma.product.create({
        data: {
          id: sourceProductId,
          ...baseData,
          status: ContentStatus.DRAFT,
          visibility: Visibility.INTERNAL,
          featured: false,
        },
      });
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

async function readProductIdsByName() {
  try {
    const raw = await readSeedDataFile("product-media-source.json");
    const rows = JSON.parse(raw) as ProductMediaSourceRow[];
    const map = new Map<string, string>();
    const duplicates = new Set<string>();

    for (const row of rows) {
      if (map.has(row.name)) duplicates.add(row.name);
      map.set(row.name, row.id);
    }
    for (const name of duplicates) map.delete(name);

    return map;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return new Map<string, string>();
    }
    throw error;
  }
}

async function readSeedDataFile(fileName: string) {
  try {
    return await readFile(new URL(`./seed-data/${fileName}`, import.meta.url), "utf-8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return await readFile(new URL(`./.tmp/${fileName}`, import.meta.url), "utf-8");
    }
    throw error;
  }
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
