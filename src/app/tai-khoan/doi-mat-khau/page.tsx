import { compare, hash } from "bcryptjs";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit";

async function changePasswordAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user?.id) redirect("/dang-nhap");

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const nextPassword = String(formData.get("nextPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (nextPassword.length < 12) throw new Error("Mật khẩu mới tối thiểu 12 ký tự.");
  if (nextPassword !== confirmPassword) throw new Error("Xác nhận mật khẩu không khớp.");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.passwordHash) throw new Error("Tài khoản này chưa có mật khẩu nội bộ.");

  const valid = await compare(currentPassword, user.passwordHash);
  if (!valid) throw new Error("Mật khẩu hiện tại không đúng.");

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

  redirect("/");
}

export default async function ChangePasswordPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/dang-nhap");

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6 py-16 text-slate-950">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">ASP Tech</p>
        <h1 className="mt-2 text-3xl font-bold">Đổi mật khẩu</h1>
        <p className="mt-2 text-sm text-slate-600">
          Tài khoản của bạn đang được yêu cầu đổi mật khẩu trước khi tiếp tục sử dụng hệ thống.
        </p>
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
      </section>
    </main>
  );
}
