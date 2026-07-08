import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not configured");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

async function main() {
  const products = await prisma.product.findMany({ include: { group: true }, orderBy: [{ updatedAt: "desc" }], take: 3 });
  console.dir(products, { depth: null });
}

main().finally(async () => prisma.$disconnect());
