import { hash } from "bcryptjs";
import { z } from "zod";
import {
  EmailConfigurationError,
  EmailDeliveryError,
  generateTemporaryPassword,
  sendRegistrationPasswordEmail,
} from "@/lib/email";
import { prisma } from "@/lib/prisma";

export class RegistrationError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "RegistrationError";
  }
}

const inputSchema = z.object({
  name: z.string().trim().min(2, "Họ tên phải có tối thiểu 2 ký tự.").max(100, "Họ tên không được vượt quá 100 ký tự."),
  email: z.string().trim().email("Email không hợp lệ.").transform((v) => v.toLowerCase()),
});

export async function registerCustomer(input: unknown) {
  if (!input || typeof input !== "object") {
    throw new RegistrationError("Dữ liệu đăng ký không hợp lệ.", 400);
  }

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    throw new RegistrationError(parsed.error.issues[0]?.message ?? "Dữ liệu đăng ký không hợp lệ.", 400);
  }

  const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) {
    throw new RegistrationError("Email này đã được đăng ký.", 409);
  }

  const password = generateTemporaryPassword();

  try {
    await sendRegistrationPasswordEmail(parsed.data.email, parsed.data.name, password);
  } catch (error) {
    if (error instanceof EmailConfigurationError) {
      throw new RegistrationError("Đăng ký không thành công vì hệ thống chưa cấu hình máy chủ gửi email.", 500);
    }

    if (error instanceof EmailDeliveryError) {
      throw new RegistrationError("Đăng ký không thành công vì không gửi được mật khẩu tới email đã nhập.", 502);
    }

    throw new RegistrationError("Đăng ký không thành công vì lỗi gửi email.", 502);
  }

  try {
    await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        emailVerified: new Date(),
        passwordHash: await hash(password, 12),
        role: "CUSTOMER",
        status: "ACTIVE",
        mustChangePassword: true,
      },
    });
  } catch {
    throw new RegistrationError("Đăng ký không thành công vì hệ thống không lưu được tài khoản vào database.", 500);
  }
}
