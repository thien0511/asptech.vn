import { Role } from "@/generated/prisma/client";

export function defaultSignedInPath(role?: Role) {
  if (role === Role.USER_ADMIN) return "/quan-tri/nguoi-dung";
  if (
    role === Role.INTERNAL_VIEWER ||
    role === Role.PRODUCT_EDITOR ||
    role === Role.CONTENT_APPROVER ||
    role === Role.SYSTEM_ADMIN
  ) {
    return "/quan-tri/san-pham";
  }

  return "/san-pham";
}
