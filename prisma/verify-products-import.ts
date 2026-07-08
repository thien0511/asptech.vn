import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not configured");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

async function main() {
  const result = {
    products: await prisma.product.count(),
    groups: await prisma.productGroup.count(),
    manufacturers: await prisma.manufacturer.count(),
    byStatusVisibility: await prisma.product.groupBy({
      by: ["status", "visibility"],
      _count: { _all: true },
    }),
  };

  console.log(JSON.stringify(result, null, 2));
}

main().finally(async () => {
  await prisma.$disconnect();
});
