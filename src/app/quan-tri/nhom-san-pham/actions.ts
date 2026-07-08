"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit";
import { canEditProducts, requireProductAdmin } from "@/lib/rbac";

const groupSchema = z.object({
  name: z.string().trim().min(1).max(180),
  slug: z.string().trim().min(1).max(180),
  sortOrder: z.coerce.number().int().min(0).max(999999),
});

export async function createProductGroupAction(formData: FormData) {
  const actor = await requireProductAdmin();
  if (!canEditProducts(actor.role)) throw new Error("Bạn không có quyền thêm nhóm sản phẩm.");

  const parsed = groupSchema.parse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    sortOrder: formData.get("sortOrder") || 0,
  });

  const group = await prisma.productGroup.create({ data: parsed });

  await writeAuditEvent({
    actorId: actor.id,
    action: "PRODUCT_GROUP_CREATE",
    entity: "ProductGroup",
    entityId: group.id,
    metadata: { name: group.name, slug: group.slug },
  });

  revalidatePath("/quan-tri/nhom-san-pham");
  revalidatePath("/quan-tri/san-pham");
  revalidatePath("/san-pham");
  redirect(`/quan-tri/nhom-san-pham/${group.id}`);
}

export async function updateProductGroupAction(formData: FormData) {
  const actor = await requireProductAdmin();
  if (!canEditProducts(actor.role)) throw new Error("Bạn không có quyền sửa nhóm sản phẩm.");

  const id = z.string().min(1).parse(formData.get("id"));
  const parsed = groupSchema.parse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    sortOrder: formData.get("sortOrder") || 0,
  });

  const before = await prisma.productGroup.findUnique({ where: { id } });
  if (!before) throw new Error("Không tìm thấy nhóm sản phẩm.");

  const group = await prisma.productGroup.update({ where: { id }, data: parsed });

  await writeAuditEvent({
    actorId: actor.id,
    action: "PRODUCT_GROUP_UPDATE",
    entity: "ProductGroup",
    entityId: group.id,
    metadata: {
      before: { name: before.name, slug: before.slug, sortOrder: before.sortOrder },
      after: { name: group.name, slug: group.slug, sortOrder: group.sortOrder },
    },
  });

  revalidatePath("/quan-tri/nhom-san-pham");
  revalidatePath(`/quan-tri/nhom-san-pham/${id}`);
  revalidatePath("/quan-tri/san-pham");
  revalidatePath("/san-pham");
  redirect(`/quan-tri/nhom-san-pham/${id}`);
}
