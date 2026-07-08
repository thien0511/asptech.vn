import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma, Visibility } from "../src/generated/prisma/client";

type ExtractedAsset = {
  title: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  size: number;
};

type ExtractedSpecification = {
  name: string;
  value: string;
  unit: string | null;
  sortOrder: number;
};

type ExtractedProductMedia = {
  id: string;
  slug: string;
  name: string;
  sourceImageSpecFolder: string | null;
  folderExists: boolean;
  assets: ExtractedAsset[];
  specifications: ExtractedSpecification[];
};

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not configured");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

async function main() {
  const projectRoot = process.cwd();
  const workspaceRoot = path.resolve(projectRoot, "..");
  const tmpDir = path.join(projectRoot, "prisma", ".tmp");
  const sourceJson = path.join(tmpDir, "product-media-source.json");
  const outputJson = path.join(tmpDir, "product-media.json");
  const publicRoot = path.join(projectRoot, "public");
  const extractor = path.join(projectRoot, "prisma", "extract-product-media.py");
  const python = process.env.PYTHON ?? process.env.PYTHON_PATH ?? "python";

  await mkdir(tmpDir, { recursive: true });

  const products = await prisma.product.findMany({
    where: { sourceImageSpecFolder: { not: null } },
    select: { id: true, slug: true, name: true, sourceImageSpecFolder: true },
    orderBy: { name: "asc" },
  });

  await writeFile(sourceJson, JSON.stringify(products, null, 2), "utf-8");

  const result = spawnSync(python, [extractor, sourceJson, workspaceRoot, publicRoot, outputJson], {
    cwd: projectRoot,
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    encoding: "utf-8",
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`Product media extraction failed with exit code ${result.status ?? "unknown"}`);
  }

  const extracted = JSON.parse(await readFile(outputJson, "utf-8")) as ExtractedProductMedia[];

  let syncedProducts = 0;
  let syncedAssets = 0;
  let syncedSpecifications = 0;
  let missingFolders = 0;

  for (const product of extracted) {
    if (!product.folderExists) {
      missingFolders += 1;
      continue;
    }

    const operations: Prisma.PrismaPromise<unknown>[] = [
      prisma.asset.deleteMany({
        where: {
          productId: product.id,
          storageKey: { startsWith: `/product-assets/${product.id}/` },
        },
      }),
      prisma.specification.deleteMany({ where: { productId: product.id } }),
    ];

    if (product.assets.length > 0) {
      operations.push(
        prisma.asset.createMany({
          data: product.assets.map((asset) => ({
            productId: product.id,
            title: asset.title,
            storageKey: asset.storageKey,
            fileName: asset.fileName,
            mimeType: asset.mimeType,
            size: asset.size,
            visibility: Visibility.PUBLIC,
          })),
          skipDuplicates: true,
        }),
      );
    }

    if (product.specifications.length > 0) {
      operations.push(
        prisma.specification.createMany({
          data: product.specifications.map((specification) => ({
            productId: product.id,
            name: specification.name,
            value: specification.value,
            unit: specification.unit,
            sortOrder: specification.sortOrder,
            visibility: Visibility.PUBLIC,
          })),
        }),
      );
    }

    await prisma.$transaction(operations);

    syncedProducts += 1;
    syncedAssets += product.assets.length;
    syncedSpecifications += product.specifications.length;
  }

  await prisma.auditEvent.create({
    data: {
      action: "PRODUCT_MEDIA_SYNC",
      entity: "Product",
      result: "SUCCESS",
      metadata: {
        source: "Product.sourceImageSpecFolder",
        products: extracted.length,
        syncedProducts,
        syncedAssets,
        syncedSpecifications,
        missingFolders,
      },
    },
  });

  console.log(
    JSON.stringify(
      {
        products: extracted.length,
        syncedProducts,
        syncedAssets,
        syncedSpecifications,
        missingFolders,
      },
      null,
      2,
    ),
  );
}

main()
  .catch(async (error) => {
    console.error(error);
    await prisma.auditEvent.create({
      data: {
        action: "PRODUCT_MEDIA_SYNC",
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
