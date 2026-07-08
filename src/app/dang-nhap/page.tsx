import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { defaultSignedInPath } from "@/lib/navigation";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) {
    redirect(defaultSignedInPath(session.user.role));
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6 py-16 text-slate-950">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">ASP Tech</p>
        <h1 className="mt-2 text-3xl font-bold">Đăng nhập</h1>
        <p className="mt-2 text-sm text-slate-600">Tài khoản nội bộ hoặc tài khoản khách hàng.</p>
        <form
          action={async (formData) => {
            "use server";
            formData.set("redirectTo", "/sau-dang-nhap");
            await signIn("credentials", formData);
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
      </section>
    </main>
  );
}
