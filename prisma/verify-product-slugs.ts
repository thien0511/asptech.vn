import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not configured");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

async function main() {
  const products = await prisma.product.findMany({ select: { name: true, slug: true }, orderBy: { name: "asc" }, take: 8 });
  console.table(products);
}

main().finally(async () => prisma.$disconnect());
