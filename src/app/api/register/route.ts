import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const inputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().email().transform((v) => v.toLowerCase()),
  password: z.string().min(12).max(128),
});

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Dữ liệu đăng ký không hợp lệ." }, { status: 400 });
  const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) return Response.json({ error: "Không thể tạo tài khoản với email này." }, { status: 409 });
  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await hash(parsed.data.password, 12),
      role: "CUSTOMER",
      status: "ACTIVE",
    },
  });
  return Response.json({ ok: true }, { status: 201 });
}
