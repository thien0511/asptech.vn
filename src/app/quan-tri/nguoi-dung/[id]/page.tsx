import Link from "next/link";
import { notFound } from "next/navigation";
import { resetUserPasswordAction, revokeUserSessionsAction, updateUserAction } from "../actions";
import { prisma } from "@/lib/prisma";
import { requireUserAdmin, roleLabels, statusLabels } from "@/lib/rbac";
import { Role, UserStatus } from "@/generated/prisma/client";

const roleOptions = Object.values(Role);
const statusOptions = Object.values(UserStatus);

function dateInputValue(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function formatDateTime(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUserAdmin();

  const { id } = await params;
  const [user, auditEvents] = await Promise.all([
    prisma.user.findUnique({ where: { id }, include: { accounts: { select: { provider: true, providerAccountId: true } } } }),
    prisma.auditEvent.findMany({
      where: { entity: "User", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  if (!user) notFound();

  return (
    <div className="space-y-6">
      <Link href="/quan-tri/nguoi-dung" className="text-sm font-medium text-blue-700">
        ← Quay lại danh sách
      </Link>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <h2 className="text-2xl font-bold">{user.name ?? user.email}</h2>
            <p className="mt-1 text-sm text-slate-600">{user.email}</p>
            <p className="mt-2 text-sm text-slate-500">
              Cập nhật: {formatDateTime(user.updatedAt)} · Đăng nhập cuối: {formatDateTime(user.lastLoginAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={revokeUserSessionsAction}>
              <input type="hidden" name="id" value={user.id} />
              <button className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50">
                Thu hồi tất cả phiên
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Thông tin & phân quyền</h3>
          <form action={updateUserAction} className="mt-4 grid gap-4 md:grid-cols-2">
            <input type="hidden" name="id" value={user.id} />
            <label className="text-sm font-medium">
              Họ tên
              <input
                name="name"
                defaultValue={user.name ?? ""}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm font-medium">
              Email
              <input
                name="email"
                type="email"
                defaultValue={user.email}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm font-medium">
              Đơn vị
              <input
                name="organization"
                defaultValue={user.organization ?? ""}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm font-medium">
              Ngày hết hạn truy cập
              <input
                name="accessExpiresAt"
                type="date"
                defaultValue={dateInputValue(user.accessExpiresAt)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm font-medium">
              Vai trò
              <select name="role" defaultValue={user.role} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
                {roleOptions.map((item) => (
                  <option key={item} value={item}>
                    {roleLabels[item]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Trạng thái
              <select
                name="status"
                defaultValue={user.status}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                {statusOptions.map((item) => (
                  <option key={item} value={item}>
                    {statusLabels[item]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm font-medium md:col-span-2">
              <input name="mustChangePassword" type="checkbox" defaultChecked={user.mustChangePassword} />
              Yêu cầu đổi mật khẩu
            </label>
            <div className="md:col-span-2">
              <button className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800">
                Lưu thay đổi
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Tài khoản đăng nhập</h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Password</dt>
                <dd className="font-medium">{user.passwordHash ? "Có" : "Không"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">OAuth</dt>
                <dd className="font-medium">
                  {user.accounts.length ? user.accounts.map((account) => account.provider).join(", ") : "Không"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Session version</dt>
                <dd className="font-medium">{user.sessionVersion}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Reset mật khẩu</h3>
            <form action={resetUserPasswordAction} className="mt-4 space-y-3">
              <input type="hidden" name="id" value={user.id} />
              <label className="block text-sm font-medium">
                Mật khẩu tạm thời mới
                <input
                  name="password"
                  type="password"
                  required
                  minLength={12}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              <p className="text-xs text-slate-500">Sau khi reset, tài khoản bị revoke phiên và bắt đổi mật khẩu.</p>
              <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50">
                Reset mật khẩu
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold">Audit người dùng này</h3>
        <div className="mt-4 divide-y divide-slate-100">
          {auditEvents.map((event) => (
            <div key={event.id} className="py-3 text-sm">
              <div className="font-medium">{event.action}</div>
              <div className="text-slate-500">
                {formatDateTime(event.createdAt)} · {event.result}
              </div>
            </div>
          ))}
          {auditEvents.length === 0 ? <p className="text-sm text-slate-500">Chưa có audit event.</p> : null}
        </div>
      </section>
    </div>
  );
}
