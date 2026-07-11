import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Visibility } from "../src/generated/prisma/client";

type MediaAsset = {
  title: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  size: number;
};

type MediaSpecification = {
  name: string;
  value: string;
  unit?: string | null;
  sortOrder: number;
};

type MediaProduct = {
  name: string;
  slug?: string;
  assets?: MediaAsset[];
  specifications?: MediaSpecification[];
};

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not configured");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

function uniqueMap<T extends { name: string; slug: string | null }>(items: T[], key: "name" | "slug") {
  const map = new Map<string, T | null>();
  for (const item of items) {
    const value = item[key];
    if (!value) continue;
    map.set(value, map.has(value) ? null : item);
  }
  return map;
}

async function main() {
  const media = JSON.parse(await readSeedDataFile("product-media.json")) as MediaProduct[];

  const products = await prisma.product.findMany({
    select: { id: true, name: true, slug: true },
  });
  const productsByName = uniqueMap(products, "name");
  const productsBySlug = uniqueMap(products, "slug");

  let matched = 0;
  let missing = 0;
  let ambiguous = 0;
  let assetCount = 0;
  let specificationCount = 0;

  for (const item of media) {
    const byName = productsByName.get(item.name);
    const bySlug = item.slug ? productsBySlug.get(item.slug) : undefined;
    const product = byName ?? bySlug;

    if (product === null || byName === null || bySlug === null) {
      ambiguous += 1;
      continue;
    }
    if (!product) {
      missing += 1;
      continue;
    }

    const assets = item.assets ?? [];
    const specifications = item.specifications ?? [];
    const storageKeys = assets.map((asset) => asset.storageKey);

    await prisma.$transaction(async (tx) => {
      await tx.specification.deleteMany({ where: { productId: product.id } });
      await tx.asset.deleteMany({ where: { productId: product.id } });
      if (storageKeys.length > 0) {
        await tx.asset.deleteMany({ where: { storageKey: { in: storageKeys } } });
      }

      if (specifications.length > 0) {
        await tx.specification.createMany({
          data: specifications.map((specification) => ({
            productId: product.id,
            name: specification.name,
            value: specification.value,
            unit: specification.unit ?? null,
            sortOrder: specification.sortOrder,
            visibility: Visibility.PUBLIC,
          })),
        });
      }

      if (assets.length > 0) {
        await tx.asset.createMany({
          data: assets.map((asset) => ({
            productId: product.id,
            title: asset.title,
            storageKey: asset.storageKey,
            fileName: asset.fileName,
            mimeType: asset.mimeType,
            size: asset.size,
            visibility: Visibility.PUBLIC,
          })),
        });
      }
    });

    matched += 1;
    assetCount += assets.length;
    specificationCount += specifications.length;
  }

  console.log(JSON.stringify({ matched, missing, ambiguous, assets: assetCount, specifications: specificationCount }, null, 2));
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
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
