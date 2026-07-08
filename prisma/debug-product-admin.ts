import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const result = await Promise.all([
    prisma.product.findMany({ include: { group: true, manufacturer: true }, orderBy: [{ updatedAt: "desc" }], take: 3 }),
    prisma.productGroup.findMany({ orderBy: { name: "asc" }, take: 3 }),
    prisma.product.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.pageVisit.findMany({ orderBy: { count: "desc" }, take: 3 }),
  ]);
  console.log(JSON.stringify(result.map((x) => Array.isArray(x) ? x.length : x), null, 2));
}

main().finally(async () => prisma.$disconnect());
