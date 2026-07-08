import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not configured");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

async function main() {
  const [products, groups] = await Promise.all([
    prisma.product.count(),
    prisma.productGroup.count(),
  ]);
  console.log(JSON.stringify({ products, groups }, null, 2));
}

main().finally(async () => prisma.$disconnect());
