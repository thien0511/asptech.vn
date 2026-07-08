import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not configured");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

async function main() {
  const products = await prisma.product.findMany({
    include: { group: true },
    orderBy: [{ group: { name: "asc" } }, { name: "asc" }],
  });

  const rows = products.map((product) => ({
    name: product.name,
    description: product.description,
    contactPerson: product.contactPerson,
    groupName: product.group.name,
  }));

  await writeFile(new URL("./products-import.json", import.meta.url), `${JSON.stringify(rows, null, 2)}\n`, "utf-8");
  console.log(JSON.stringify({ rows: rows.length }, null, 2));
}

main().finally(async () => {
  await prisma.$disconnect();
});
