import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not configured");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

async function main() {
  const columns = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    "select column_name from information_schema.columns where table_schema='public' and table_name='Product' order by ordinal_position",
  );
  const manufacturer = await prisma.$queryRawUnsafe<Array<{ table: string | null }>>(
    "select to_regclass('public.\"Manufacturer\"')::text as table",
  );

  console.log(
    JSON.stringify(
      {
        productColumns: columns.map((column) => column.column_name),
        manufacturerTable: manufacturer[0]?.table ?? null,
      },
      null,
      2,
    ),
  );
}

main().finally(async () => {
  await prisma.$disconnect();
});
