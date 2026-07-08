import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role, UserStatus } from "../src/generated/prisma/client";

function requiredEnv(name: "DATABASE_URL" | "SEED_TEST_PASSWORD") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const password = requiredEnv("SEED_TEST_PASSWORD");
const url = requiredEnv("DATABASE_URL");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const accounts: Array<[string, string, Role]> = [
  ["Customer Test", "customer.test@asptech.vn", Role.CUSTOMER],
  ["Internal Viewer Test", "viewer.test@asptech.vn", Role.INTERNAL_VIEWER],
  ["Product Editor Test", "editor.test@asptech.vn", Role.PRODUCT_EDITOR],
  ["Content Approver Test", "approver.test@asptech.vn", Role.CONTENT_APPROVER],
  ["User Admin Test", "useradmin.test@asptech.vn", Role.USER_ADMIN],
  ["System Admin Test", "sysadmin.test@asptech.vn", Role.SYSTEM_ADMIN],
];

async function main() {
  const passwordHash = await hash(password, 12);
  for (const [name, email, role] of accounts) {
    await prisma.user.upsert({
      where: { email },
      update: { name, role, status: UserStatus.ACTIVE, passwordHash },
      create: { name, email, role, status: UserStatus.ACTIVE, passwordHash, emailVerified: new Date() },
    });
  }
  console.log(`Seeded ${accounts.length} role test accounts.`);
}

main().finally(() => prisma.$disconnect());
