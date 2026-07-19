import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { canAccessProductAdmin, canManageUsers, requireAdminAreaAccess } from "@/lib/rbac";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminAreaAccess();

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <Link href="/" className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
              ASP Tech
            </Link>
            <h1 className="text-xl font-bold">Quản trị hệ thống</h1>
          </div>
          <div className="text-right text-sm text-slate-600">
            <div>{user.email}</div>
            <nav className="flex items-center gap-3">
              {canManageUsers(user.role) ? (
                <Link href="/quan-tri/nguoi-dung" className="font-medium text-blue-700">
                  Người dùng
                </Link>
              ) : null}
              {canAccessProductAdmin(user.role) ? (
                <>
                  <Link href="/quan-tri/san-pham" className="font-medium text-blue-700">
                    Sản phẩm
                  </Link>
                  <Link href="/quan-tri/nhom-san-pham" className="font-medium text-blue-700">
                    Nhóm sản phẩm
                  </Link>
                </>
              ) : null}
              <Link href="/" className="font-medium text-slate-700 hover:text-blue-700">
                Trang chủ
              </Link>
              <Link href="/tai-khoan/doi-mat-khau" className="font-medium text-slate-700 hover:text-blue-700">
                Đổi mật khẩu
              </Link>
              <SignOutButton className="font-medium text-slate-700 hover:text-red-700" />
            </nav>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
    </main>
  );
}
