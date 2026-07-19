import Link from "next/link";
import { redirect } from "next/navigation";
import { registerCustomer, RegistrationError } from "@/lib/registration";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function valueOf(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

async function registerAction(formData: FormData) {
  "use server";

  try {
    await registerCustomer({
      name: formData.get("name"),
      email: formData.get("email"),
    });
  } catch (error) {
    const message =
      error instanceof RegistrationError ? error.message : "Đăng ký không thành công vì lỗi hệ thống.";
    redirect(`/dang-ky?error=${encodeURIComponent(message)}`);
  }

  redirect("/dang-ky?success=1");
}

export default async function RegisterPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const success = valueOf(params, "success") === "1";
  const error = valueOf(params, "error");
  const message = success
    ? "Tạo tài khoản thành công. Mật khẩu tạm thời đã được gửi về email đăng ký."
    : error;

  return (
    <main className="mx-auto grid min-h-screen max-w-6xl place-items-center px-6 py-16">
      <form action={registerAction} className="w-full max-w-md space-y-4 rounded-2xl border bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold">Đăng ký khách hàng</h1>
        <p className="text-sm leading-6 text-slate-600">
          Hệ thống sẽ tạo mật khẩu tạm thời và gửi về email đăng ký sau khi email được chấp nhận.
        </p>
        <label className="block text-sm font-medium">
          Họ tên
          <input name="name" type="text" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        <label className="block text-sm font-medium">
          Email
          <input name="email" type="email" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        <button className="w-full rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800">
          Tạo tài khoản
        </button>
        <p
          className={`min-h-12 rounded-lg px-4 py-3 text-sm font-medium ${
            success
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : error
                ? "border border-red-200 bg-red-50 text-red-700"
                : "border border-transparent text-slate-500"
          }`}
          role="status"
          aria-live="polite"
        >
          {message || "Sau khi gửi đăng ký, kết quả sẽ hiển thị tại đây."}
        </p>
        <Link href="/dang-nhap" className="block text-center text-sm text-blue-700">
          Quay lại đăng nhập
        </Link>
        <Link href="/" className="block text-center text-sm text-slate-600 hover:text-blue-700">
          Quay về trang chủ
        </Link>
      </form>
    </main>
  );
}
