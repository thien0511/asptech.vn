import { hash } from "bcryptjs";
import { z } from "zod";
import {
  EmailConfigurationError,
  EmailDeliveryError,
  generateTemporaryPassword,
  sendPasswordResetEmail,
} from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { UserStatus } from "@/generated/prisma/client";

export class PasswordResetError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "PasswordResetError";
  }
}

const inputSchema = z.object({
  email: z.string().trim().email("Email không hợp lệ.").transform((value) => value.toLowerCase()),
});

export async function resetForgottenPassword(input: unknown) {
  if (!input || typeof input !== "object") {
    throw new PasswordResetError("Dữ liệu reset mật khẩu không hợp lệ.", 400);
  }

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    throw new PasswordResetError(parsed.error.issues[0]?.message ?? "Dữ liệu reset mật khẩu không hợp lệ.", 400);
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) {
    throw new PasswordResetError("Không tìm thấy tài khoản với email này.", 404);
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new PasswordResetError("Tài khoản này đang bị khóa hoặc chưa được kích hoạt.", 403);
  }

  if (!user.passwordHash) {
    throw new PasswordResetError("Tài khoản này không sử dụng mật khẩu nội bộ.", 400);
  }

  const password = generateTemporaryPassword();

  try {
    await sendPasswordResetEmail(user.email, user.name ?? user.email, password);
  } catch (error) {
    if (error instanceof EmailConfigurationError) {
      throw new PasswordResetError("Reset mật khẩu không thành công vì hệ thống chưa cấu hình máy chủ gửi email.", 500);
    }

    if (error instanceof EmailDeliveryError) {
      throw new PasswordResetError("Reset mật khẩu không thành công vì không gửi được mật khẩu tạm thời tới email đã nhập.", 502);
    }

    throw new PasswordResetError("Reset mật khẩu không thành công vì lỗi gửi email.", 502);
  }

  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await hash(password, 12),
          mustChangePassword: true,
          sessionVersion: { increment: 1 },
        },
      }),
      prisma.session.deleteMany({ where: { userId: user.id } }),
    ]);
  } catch {
    throw new PasswordResetError("Reset mật khẩu không thành công vì hệ thống không lưu được mật khẩu mới vào database.", 500);
  }
}
