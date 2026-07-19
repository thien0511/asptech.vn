import { registerCustomer, RegistrationError } from "@/lib/registration";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await registerCustomer(await request.json().catch(() => null));
  } catch (error) {
    if (error instanceof RegistrationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Đăng ký không thành công vì lỗi hệ thống." }, { status: 500 });
  }

  return Response.json({ ok: true }, { status: 201 });
}
