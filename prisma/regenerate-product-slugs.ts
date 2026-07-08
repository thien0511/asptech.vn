import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not configured");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

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

async function main() {
  const products = await prisma.product.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } });
  const used = new Set<string>();
  let changed = 0;

  for (const product of products) {
    const base = slugify(product.name) || "san-pham";
    let slug = base;
    let counter = 2;
    while (used.has(slug)) {
      slug = `${base}-${counter}`;
      counter += 1;
    }
    used.add(slug);

    if (slug !== product.slug) {
      await prisma.product.update({ where: { id: product.id }, data: { slug } });
      changed += 1;
    }
  }

  await prisma.auditEvent.create({
    data: {
      action: "PRODUCT_SLUG_REGENERATE",
      entity: "Product",
      result: "SUCCESS",
      metadata: { products: products.length, changed, rule: "slugify(product.name)" },
    },
  });

  console.log(JSON.stringify({ products: products.length, changed }, null, 2));
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
