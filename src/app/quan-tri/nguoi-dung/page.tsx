import Link from "next/link";
import { createUserAction, revokeUserSessionsAction } from "./actions";
import { prisma } from "@/lib/prisma";
import { requireUserAdmin, roleLabels, statusLabels } from "@/lib/rbac";
import { Prisma, Role, UserStatus } from "@/generated/prisma/client";

const roleOptions = Object.values(Role);
const statusOptions = Object.values(UserStatus);

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function valueOf(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function accountTypeLabel(accounts: { provider: string }[], hasPassword: boolean) {
  const providers = new Set(accounts.map((account) => account.provider));
  if (hasPassword && providers.has("google")) return "Password + Google";
  if (providers.has("google")) return "Google";
  if (hasPassword) return "Password";
  return "Chưa có đăng nhập";
}

function formatDate(date: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(date);
}

export default async function UserAdminPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUserAdmin();

  const params = await searchParams;
  const q = valueOf(params, "q")?.trim();
  const role = valueOf(params, "role") as Role | undefined;
  const status = valueOf(params, "status") as UserStatus | undefined;
  const organization = valueOf(params, "organization")?.trim();
  const accountType = valueOf(params, "accountType");

  const where: Prisma.UserWhereInput = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { organization: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(role && roleOptions.includes(role) ? { role } : {}),
    ...(status && statusOptions.includes(status) ? { status } : {}),
    ...(organization ? { organization } : {}),
    ...(accountType === "password" ? { passwordHash: { not: null } } : {}),
    ...(accountType === "google" ? { accounts: { some: { provider: "google" } } } : {}),
    ...(accountType === "none" ? { passwordHash: null, accounts: { none: {} } } : {}),
  };

  const [users, organizations, recentAuditEvents] = await Promise.all([
    prisma.user.findMany({
      where,
      include: { accounts: { select: { provider: true } } },
      orderBy: [{ role: "desc" }, { updatedAt: "desc" }],
      take: 100,
    }),
    prisma.user.findMany({
      where: { organization: { not: null } },
      select: { organization: true },
      distinct: ["organization"],
      orderBy: { organization: "asc" },
    }),
    prisma.auditEvent.findMany({
      where: { entity: "User" },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-bold">Người dùng & phân quyền</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Đáp ứng FR-030 đến FR-034: tạo/sửa/khóa user, lọc theo trạng thái/loại tài khoản/vai trò/đơn vị,
          không xóa vật lý, revoke phiên, yêu cầu đổi mật khẩu và bảo vệ quản trị viên cuối cùng.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold">Bộ lọc</h3>
        <form className="mt-4 grid gap-3 md:grid-cols-5">
          <input
            name="q"
            defaultValue={q}
            placeholder="Tên, email, đơn vị"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select name="role" defaultValue={role ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Tất cả vai trò</option>
            {roleOptions.map((item) => (
              <option key={item} value={item}>
                {roleLabels[item]}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={status ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Tất cả trạng thái</option>
            {statusOptions.map((item) => (
              <option key={item} value={item}>
                {statusLabels[item]}
              </option>
            ))}
          </select>
          <select
            name="accountType"
            defaultValue={accountType ?? ""}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Tất cả loại tài khoản</option>
            <option value="password">Password</option>
            <option value="google">Google</option>
            <option value="none">Chưa có đăng nhập</option>
          </select>
          <select
            name="organization"
            defaultValue={organization ?? ""}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Tất cả đơn vị</option>
            {organizations.map((item) =>
              item.organization ? (
                <option key={item.organization} value={item.organization}>
                  {item.organization}
                </option>
              ) : null,
            )}
          </select>
          <div className="flex gap-2 md:col-span-5">
            <button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
              Lọc
            </button>
            <Link href="/quan-tri/nguoi-dung" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">
              Xóa lọc
            </Link>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-semibold">Danh sách người dùng ({users.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Người dùng</th>
                <th className="px-5 py-3">Vai trò</th>
                <th className="px-5 py-3">Trạng thái</th>
                <th className="px-5 py-3">Loại tài khoản</th>
                <th className="px-5 py-3">Đơn vị</th>
                <th className="px-5 py-3">Hết hạn</th>
                <th className="px-5 py-3">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-5 py-4">
                    <div className="font-medium text-slate-950">{user.name ?? "Chưa đặt tên"}</div>
                    <div className="text-slate-500">{user.email}</div>
                    {user.mustChangePassword ? <div className="mt-1 text-xs text-amber-700">Yêu cầu đổi mật khẩu</div> : null}
                  </td>
                  <td className="px-5 py-4">{roleLabels[user.role]}</td>
                  <td className="px-5 py-4">{statusLabels[user.status]}</td>
                  <td className="px-5 py-4">{accountTypeLabel(user.accounts, Boolean(user.passwordHash))}</td>
                  <td className="px-5 py-4">{user.organization ?? "—"}</td>
                  <td className="px-5 py-4">{formatDate(user.accessExpiresAt)}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/quan-tri/nguoi-dung/${user.id}`}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-50"
                      >
                        Sửa
                      </Link>
                      <form action={revokeUserSessionsAction}>
                        <input type="hidden" name="id" value={user.id} />
                        <button className="rounded-lg border border-amber-300 px-3 py-1.5 font-medium text-amber-800 hover:bg-amber-50">
                          Revoke phiên
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[1fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Tạo người dùng mới</h3>
          <form action={createUserAction} className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium">
              Họ tên
              <input name="name" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="text-sm font-medium">
              Email
              <input name="email" type="email" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="text-sm font-medium">
              Đơn vị
              <input name="organization" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="text-sm font-medium">
              Mật khẩu tạm thời
              <input
                name="password"
                type="password"
                required
                minLength={12}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm font-medium">
              Vai trò
              <select name="role" defaultValue={Role.CUSTOMER} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
                {roleOptions.map((item) => (
                  <option key={item} value={item}>
                    {roleLabels[item]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Trạng thái
              <select name="status" defaultValue={UserStatus.ACTIVE} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
                {statusOptions.map((item) => (
                  <option key={item} value={item}>
                    {statusLabels[item]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Ngày hết hạn truy cập
              <input name="accessExpiresAt" type="date" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="flex items-center gap-2 pt-6 text-sm font-medium">
              <input name="mustChangePassword" type="checkbox" defaultChecked />
              Yêu cầu đổi mật khẩu sau đăng nhập
            </label>
            <div className="md:col-span-2">
              <button className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800">
                Tạo người dùng
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Audit gần đây</h3>
          <div className="mt-4 space-y-3">
            {recentAuditEvents.map((event) => (
              <div key={event.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
                <div className="font-medium">{event.action}</div>
                <div className="text-slate-500">
                  {formatDate(event.createdAt)} · {event.result}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
