import { prisma } from "@/lib/prisma";

export async function trackPageVisit(path: string) {
  try {
    await prisma.pageVisit.upsert({
      where: { path },
      update: { count: { increment: 1 } },
      create: { path, count: 1 },
    });
  } catch {
    // Visit counting must never break the user-facing page.
  }
}
