import { ContentStatus, Visibility } from "@/generated/prisma/client";

export const contentStatusLabels: Record<ContentStatus, string> = {
  DRAFT: "Nháp",
  IN_REVIEW: "Chờ duyệt",
  PUBLISHED: "Đã xuất bản",
  UNPUBLISHED: "Đã gỡ xuất bản",
  ARCHIVED: "Lưu trữ",
};

export const visibilityLabels: Record<Visibility, string> = {
  PUBLIC: "Công khai",
  INTERNAL: "Nội bộ",
  RESTRICTED: "Hạn chế",
};
