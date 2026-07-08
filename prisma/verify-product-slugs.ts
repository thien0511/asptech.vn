import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
async function main() {
  const products = await prisma.product.findMany({ select: { name: true, model: true, slug: true }, orderBy: { name: "asc" }, take: 8 });
  console.log(JSON.stringify(products, null, 2));
}
main().finally(async () => prisma.$disconnect());
