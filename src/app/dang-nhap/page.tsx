import Link from "next/link";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { defaultSignedInPath } from "@/lib/navigation";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function valueOf(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (session?.user) {
    if (session.user.mustChangePassword) {
      redirect("/tai-khoan/doi-mat-khau");
    }
    redirect(defaultSignedInPath(session.user.role));
  }

  const params = await searchParams;
  const error = valueOf(params, "error");
  const message =
    error === "CredentialsSignin"
      ? "Email hoặc mật khẩu không đúng. Vui lòng kiểm tra lại thông tin đăng nhập."
      : undefined;

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6 py-16 text-slate-950">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">ASP Tech</p>
        <h1 className="mt-2 text-3xl font-bold">Đăng nhập</h1>
        <p className="mt-2 text-sm text-slate-600">Tài khoản nội bộ hoặc tài khoản khách hàng.</p>
        {message ? (
          <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
            {message}
          </p>
        ) : null}
        <form
          action={async (formData) => {
            "use server";
            formData.set("redirectTo", "/sau-dang-nhap");
            try {
              await signIn("credentials", formData);
            } catch (error) {
              if (error instanceof AuthError) {
                redirect("/dang-nhap?error=CredentialsSignin");
              }
              throw error;
            }
          }}
          className="mt-8 space-y-4"
        >
          <label className="block text-sm font-medium">
            Email
            <input name="email" type="email" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="block text-sm font-medium">
            Mật khẩu
            <input name="password" type="password" required minLength={8} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <Link href="/quen-mat-khau" className="block text-right text-sm font-medium text-blue-700">
            Quên mật khẩu?
          </Link>
          <button className="w-full rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800">Đăng nhập</button>
        </form>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/sau-dang-nhap" });
          }}
          className="mt-3"
        >
          <button 
            type="button"
            disabled
            aria-disabled="true"
            title="Tính năng đang được phát triển"
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-800 hover:bg-slate-50 cursor-not-allowed"
          >
            Đăng nhập bằng Google
          </button>
        </form>
        <Link href="/dang-ky" className="mt-6 block text-center text-sm font-medium text-blue-700">
          Chưa có tài khoản? Đăng ký
        </Link>
        <Link href="/" className="mt-3 block text-center text-sm font-medium text-slate-600 hover:text-blue-700">
          Quay về trang chủ
        </Link>
      </section>
    </main>
  );
}
