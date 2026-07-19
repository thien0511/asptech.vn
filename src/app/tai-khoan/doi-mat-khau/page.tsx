import Link from "next/link";
import { compare, hash } from "bcryptjs";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function valueOf(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

async function changePasswordAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user?.id) redirect("/dang-nhap");

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const nextPassword = String(formData.get("nextPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (nextPassword.length < 12) {
    redirect(`/tai-khoan/doi-mat-khau?error=${encodeURIComponent("Mật khẩu mới tối thiểu 12 ký tự.")}`);
  }

  if (nextPassword !== confirmPassword) {
    redirect(`/tai-khoan/doi-mat-khau?error=${encodeURIComponent("Xác nhận mật khẩu không khớp.")}`);
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.passwordHash) {
    redirect(`/tai-khoan/doi-mat-khau?error=${encodeURIComponent("Tài khoản này chưa có mật khẩu nội bộ.")}`);
  }

  const valid = await compare(currentPassword, user.passwordHash);
  if (!valid) {
    redirect(`/tai-khoan/doi-mat-khau?error=${encodeURIComponent("Mật khẩu hiện tại không đúng.")}`);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hash(nextPassword, 12),
      mustChangePassword: false,
    },
  });

  await writeAuditEvent({
    actorId: user.id,
    action: "USER_PASSWORD_CHANGE",
    entity: "User",
    entityId: user.id,
    metadata: { selfService: true },
  });

  redirect("/tai-khoan/doi-mat-khau?success=1");
}

export default async function ChangePasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/dang-nhap");

  const params = await searchParams;
  const success = valueOf(params, "success") === "1";
  const error = valueOf(params, "error");
  const message = success ? "Đổi mật khẩu thành công." : error;

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6 py-16 text-slate-950">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">ASP Tech</p>
        <h1 className="mt-2 text-3xl font-bold">Đổi mật khẩu</h1>
        <p className="mt-2 text-sm text-slate-600">
          Cập nhật mật khẩu tài khoản của bạn. Mật khẩu mới cần tối thiểu 12 ký tự.
        </p>
        {session.user.mustChangePassword ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            Tài khoản của bạn đang được yêu cầu đổi mật khẩu trước khi tiếp tục sử dụng hệ thống.
          </p>
        ) : null}
        <form action={changePasswordAction} className="mt-8 space-y-4">
          <label className="block text-sm font-medium">
            Mật khẩu hiện tại
            <input
              name="currentPassword"
              type="password"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            Mật khẩu mới
            <input
              name="nextPassword"
              type="password"
              required
              minLength={12}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            Xác nhận mật khẩu mới
            <input
              name="confirmPassword"
              type="password"
              required
              minLength={12}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <button className="w-full rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800">
            Cập nhật mật khẩu
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
          {message || "Kết quả đổi mật khẩu sẽ hiển thị tại đây."}
        </p>
        <div className="mt-4 flex justify-center gap-4 text-sm">
          <Link href="/" className="font-medium text-slate-600 hover:text-blue-700">
            Trang chủ
          </Link>
          <Link href="/san-pham" className="font-medium text-blue-700">
            Danh mục sản phẩm
          </Link>
        </div>
      </section>
    </main>
  );
}
