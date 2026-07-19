import Link from "next/link";
import { redirect } from "next/navigation";
import { resetForgottenPassword, PasswordResetError } from "@/lib/password-reset";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function valueOf(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

async function resetPasswordAction(formData: FormData) {
  "use server";

  try {
    await resetForgottenPassword({
      email: formData.get("email"),
    });
  } catch (error) {
    const message =
      error instanceof PasswordResetError ? error.message : "Reset mật khẩu không thành công vì lỗi hệ thống.";
    redirect(`/quen-mat-khau?error=${encodeURIComponent(message)}`);
  }

  redirect("/quen-mat-khau?success=1");
}

export default async function ForgotPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const success = valueOf(params, "success") === "1";
  const error = valueOf(params, "error");
  const message = success
    ? "Reset mật khẩu thành công. Mật khẩu tạm thời đã được gửi về email của bạn."
    : error;

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6 py-16 text-slate-950">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">ASP Tech</p>
        <h1 className="mt-2 text-3xl font-bold">Quên mật khẩu</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Nhập email tài khoản. Hệ thống sẽ gửi mật khẩu tạm thời mới nếu tài khoản hợp lệ.
        </p>
        <form action={resetPasswordAction} className="mt-8 space-y-4">
          <label className="block text-sm font-medium">
            Email
            <input name="email" type="email" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <button className="w-full rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800">
            Gửi mật khẩu tạm thời
          </button>
        </form>
        <p
          className={`mt-4 min-h-12 rounded-lg px-4 py-3 text-sm font-medium ${
            success
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : error
                ? "border border-red-200 bg-red-50 text-red-700"
                : "border border-transparent text-slate-500"
          }`}
          role="status"
          aria-live="polite"
        >
          {message || "Kết quả reset mật khẩu sẽ hiển thị tại đây."}
        </p>
        <div className="mt-4 flex justify-center gap-4 text-sm">
          <Link href="/dang-nhap" className="font-medium text-blue-700">
            Quay lại đăng nhập
          </Link>
          <Link href="/" className="font-medium text-slate-600 hover:text-blue-700">
            Trang chủ
          </Link>
        </div>
      </section>
    </main>
  );
}
