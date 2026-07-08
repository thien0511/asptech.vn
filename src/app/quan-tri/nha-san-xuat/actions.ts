"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit";
import { canEditProducts, requireProductAdmin } from "@/lib/rbac";

const manufacturerSchema = z.object({
  name: z.string().trim().min(1).max(180),
  country: z.string().trim().max(120).optional(),
  website: z.string().trim().max(500).optional(),
});

function optionalText(value?: string) {
  return value?.trim() || null;
}

export async function createManufacturerAction(formData: FormData) {
  const actor = await requireProductAdmin();
  if (!canEditProducts(actor.role)) throw new Error("Bạn không có quyền thêm nhà sản xuất.");

  const parsed = manufacturerSchema.parse({
    name: formData.get("name"),
    country: formData.get("country") || undefined,
    website: formData.get("website") || undefined,
  });

  const manufacturer = await prisma.manufacturer.create({
    data: {
      name: parsed.name,
      country: optionalText(parsed.country),
      website: optionalText(parsed.website),
    },
  });

  await writeAuditEvent({
    actorId: actor.id,
    action: "MANUFACTURER_CREATE",
    entity: "Manufacturer",
    entityId: manufacturer.id,
    metadata: { name: manufacturer.name },
  });

  revalidatePath("/quan-tri/nha-san-xuat");
  redirect(`/quan-tri/nha-san-xuat/${manufacturer.id}`);
}

export async function updateManufacturerAction(formData: FormData) {
  const actor = await requireProductAdmin();
  if (!canEditProducts(actor.role)) throw new Error("Bạn không có quyền sửa nhà sản xuất.");

  const id = z.string().min(1).parse(formData.get("id"));
  const parsed = manufacturerSchema.parse({
    name: formData.get("name"),
    country: formData.get("country") || undefined,
    website: formData.get("website") || undefined,
  });

  const manufacturer = await prisma.manufacturer.update({
    where: { id },
    data: {
      name: parsed.name,
      country: optionalText(parsed.country),
      website: optionalText(parsed.website),
    },
  });

  await writeAuditEvent({
    actorId: actor.id,
    action: "MANUFACTURER_UPDATE",
    entity: "Manufacturer",
    entityId: manufacturer.id,
    metadata: { name: manufacturer.name },
  });

  revalidatePath("/quan-tri/nha-san-xuat");
  revalidatePath(`/quan-tri/nha-san-xuat/${id}`);
  redirect(`/quan-tri/nha-san-xuat/${id}`);
}
