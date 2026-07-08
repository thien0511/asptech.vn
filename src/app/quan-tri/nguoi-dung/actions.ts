"use server";

import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit";
import { isAdminRole, requireUserAdmin } from "@/lib/rbac";
import { Role, UserStatus } from "@/generated/prisma/client";

const roles = Object.values(Role) as [Role, ...Role[]];
const statuses = Object.values(UserStatus) as [UserStatus, ...UserStatus[]];

const baseUserSchema = z.object({
  name: z.string().trim().min(1, "Tên là bắt buộc").max(120),
  email: z.string().trim().email("Email không hợp lệ").transform((value) => value.toLowerCase()),
  organization: z.string().trim().max(160).optional(),
  role: z.enum(roles),
  status: z.enum(statuses),
  mustChangePassword: z.boolean(),
  accessExpiresAt: z.string().trim().optional(),
});

function optionalDate(value?: string) {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59.999`);
  if (Number.isNaN(date.getTime())) throw new Error("Ngày hết hạn không hợp lệ");
  return date;
}

async function assertActiveAdminRemains(targetUserId: string, nextRole: Role, nextStatus: UserStatus) {
  if (isAdminRole(nextRole) && nextStatus === UserStatus.ACTIVE) return;

  const otherActiveAdmins = await prisma.user.count({
    where: {
      id: { not: targetUserId },
      status: UserStatus.ACTIVE,
      role: { in: [Role.USER_ADMIN, Role.SYSTEM_ADMIN] },
    },
  });

  if (otherActiveAdmins === 0) {
    throw new Error("Không thể khóa hoặc gỡ quyền quản trị của quản trị viên hoạt động cuối cùng.");
  }
}

export async function createUserAction(formData: FormData) {
  const actor = await requireUserAdmin();
  const parsed = baseUserSchema
    .extend({ password: z.string().min(12, "Mật khẩu tạm thời tối thiểu 12 ký tự") })
    .parse({
      name: formData.get("name"),
      email: formData.get("email"),
      organization: formData.get("organization") || undefined,
      role: formData.get("role"),
      status: formData.get("status"),
      mustChangePassword: formData.get("mustChangePassword") === "on",
      accessExpiresAt: formData.get("accessExpiresAt") || undefined,
      password: formData.get("password"),
    });

  const passwordHash = await hash(parsed.password, 12);

  try {
    const user = await prisma.user.create({
      data: {
        name: parsed.name,
        email: parsed.email,
        organization: parsed.organization || null,
        role: parsed.role,
        status: parsed.status,
        mustChangePassword: parsed.mustChangePassword,
        accessExpiresAt: optionalDate(parsed.accessExpiresAt),
        passwordHash,
        emailVerified: parsed.status === UserStatus.ACTIVE ? new Date() : null,
      },
    });

    await writeAuditEvent({
      actorId: actor.id,
      action: "USER_CREATE",
      entity: "User",
      entityId: user.id,
      metadata: { email: user.email, role: user.role, status: user.status },
    });
  } catch (error) {
    await writeAuditEvent({
      actorId: actor.id,
      action: "USER_CREATE",
      entity: "User",
      result: "FAILURE",
      metadata: { email: parsed.email, error: error instanceof Error ? error.message : String(error) },
    });
    throw error;
  }

  revalidatePath("/quan-tri/nguoi-dung");
  redirect("/quan-tri/nguoi-dung");
}

export async function updateUserAction(formData: FormData) {
  const actor = await requireUserAdmin();
  const id = z.string().min(1).parse(formData.get("id"));
  const parsed = baseUserSchema.parse({
    name: formData.get("name"),
    email: formData.get("email"),
    organization: formData.get("organization") || undefined,
    role: formData.get("role"),
    status: formData.get("status"),
    mustChangePassword: formData.get("mustChangePassword") === "on",
    accessExpiresAt: formData.get("accessExpiresAt") || undefined,
  });

  const current = await prisma.user.findUnique({ where: { id } });
  if (!current) throw new Error("Không tìm thấy người dùng.");

  if (actor.id === id && parsed.status === UserStatus.DISABLED) {
    throw new Error("Không thể tự khóa tài khoản đang đăng nhập.");
  }

  if (actor.id === id && !isAdminRole(parsed.role)) {
    throw new Error("Không thể tự gỡ quyền quản trị của tài khoản đang đăng nhập.");
  }

  await assertActiveAdminRemains(id, parsed.role, parsed.status);

  const securityChanged =
    current.role !== parsed.role ||
    current.status !== parsed.status ||
    current.mustChangePassword !== parsed.mustChangePassword ||
    current.accessExpiresAt?.toISOString() !== optionalDate(parsed.accessExpiresAt)?.toISOString();

  const updated = await prisma.user.update({
    where: { id },
    data: {
      name: parsed.name,
      email: parsed.email,
      organization: parsed.organization || null,
      role: parsed.role,
      status: parsed.status,
      mustChangePassword: parsed.mustChangePassword,
      accessExpiresAt: optionalDate(parsed.accessExpiresAt),
      sessionVersion: securityChanged ? { increment: 1 } : undefined,
    },
  });

  await writeAuditEvent({
    actorId: actor.id,
    action: "USER_UPDATE",
    entity: "User",
    entityId: id,
    metadata: {
      before: {
        email: current.email,
        role: current.role,
        status: current.status,
        organization: current.organization,
        mustChangePassword: current.mustChangePassword,
        accessExpiresAt: current.accessExpiresAt?.toISOString() ?? null,
      },
      after: {
        email: updated.email,
        role: updated.role,
        status: updated.status,
        organization: updated.organization,
        mustChangePassword: updated.mustChangePassword,
        accessExpiresAt: updated.accessExpiresAt?.toISOString() ?? null,
      },
    },
  });

  revalidatePath("/quan-tri/nguoi-dung");
  revalidatePath(`/quan-tri/nguoi-dung/${id}`);
  redirect(`/quan-tri/nguoi-dung/${id}`);
}

export async function revokeUserSessionsAction(formData: FormData) {
  const actor = await requireUserAdmin();
  const id = z.string().min(1).parse(formData.get("id"));

  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId: id } }),
    prisma.user.update({ where: { id }, data: { sessionVersion: { increment: 1 } } }),
    prisma.auditEvent.create({
      data: {
        actorId: actor.id,
        action: "USER_REVOKE_SESSIONS",
        entity: "User",
        entityId: id,
        result: "SUCCESS",
        metadata: {},
      },
    }),
  ]);

  revalidatePath("/quan-tri/nguoi-dung");
  revalidatePath(`/quan-tri/nguoi-dung/${id}`);
}

export async function resetUserPasswordAction(formData: FormData) {
  const actor = await requireUserAdmin();
  const id = z.string().min(1).parse(formData.get("id"));
  const password = z.string().min(12, "Mật khẩu mới tối thiểu 12 ký tự").parse(formData.get("password"));
  const passwordHash = await hash(password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        mustChangePassword: true,
        sessionVersion: { increment: 1 },
      },
    }),
    prisma.auditEvent.create({
      data: {
        actorId: actor.id,
        action: "USER_PASSWORD_RESET",
        entity: "User",
        entityId: id,
        result: "SUCCESS",
        metadata: { mustChangePassword: true },
      },
    }),
  ]);

  revalidatePath("/quan-tri/nguoi-dung");
  revalidatePath(`/quan-tri/nguoi-dung/${id}`);
}
