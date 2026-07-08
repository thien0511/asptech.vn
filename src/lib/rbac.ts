import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Role, UserStatus } from "@/generated/prisma/client";

export const roleLabels: Record<Role, string> = {
  CUSTOMER: "Khách hàng",
  INTERNAL_VIEWER: "Nội bộ - xem",
  PRODUCT_EDITOR: "Biên tập sản phẩm",
  CONTENT_APPROVER: "Duyệt nội dung",
  USER_ADMIN: "Quản trị người dùng",
  SYSTEM_ADMIN: "Quản trị hệ thống",
};

export const statusLabels: Record<UserStatus, string> = {
  ACTIVE: "Hoạt động",
  DISABLED: "Đã khóa",
  PENDING: "Chờ duyệt",
};

export const adminRoles = [Role.USER_ADMIN, Role.SYSTEM_ADMIN] as const;

export function canManageUsers(role?: Role) {
  return role === Role.USER_ADMIN || role === Role.SYSTEM_ADMIN;
}

export function canAccessProductAdmin(role?: Role) {
  return (
    role === Role.INTERNAL_VIEWER ||
    role === Role.PRODUCT_EDITOR ||
    role === Role.CONTENT_APPROVER ||
    role === Role.SYSTEM_ADMIN
  );
}

export function canEditProducts(role?: Role) {
  return role === Role.PRODUCT_EDITOR || role === Role.CONTENT_APPROVER || role === Role.SYSTEM_ADMIN;
}

export function canApproveProducts(role?: Role) {
  return role === Role.CONTENT_APPROVER || role === Role.SYSTEM_ADMIN;
}

export function isAdminRole(role: Role) {
  return adminRoles.includes(role as (typeof adminRoles)[number]);
}

async function requireActiveSession() {
  const session = await auth();
  if (!session?.user?.id || session.user.status !== UserStatus.ACTIVE) {
    redirect("/dang-nhap");
  }
  if (session.user.mustChangePassword) {
    redirect("/tai-khoan/doi-mat-khau");
  }

  return session.user;
}

export async function requireAdminAreaAccess() {
  const user = await requireActiveSession();
  if (!canManageUsers(user.role) && !canAccessProductAdmin(user.role)) {
    redirect("/");
  }

  return user;
}

export async function requireUserAdmin() {
  const user = await requireActiveSession();
  if (!canManageUsers(user.role)) {
    redirect("/");
  }

  return user;
}

export async function requireProductAdmin() {
  const user = await requireActiveSession();
  if (!canAccessProductAdmin(user.role)) {
    redirect("/");
  }

  return user;
}
