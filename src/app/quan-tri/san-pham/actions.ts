"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit";
import { canApproveProducts, canEditProducts, requireProductAdmin } from "@/lib/rbac";
import { parseSpecificationsFromXlsxFile, type ParsedSpecification } from "@/lib/xlsx-specifications";
import { ContentStatus, Prisma, Visibility } from "@/generated/prisma/client";

const visibilityOptions = Object.values(Visibility) as [Visibility, ...Visibility[]];
const maxImageUploadBytes = 10 * 1024 * 1024;
const maxSpecificationUploadBytes = 5 * 1024 * 1024;

const productFormSchema = z.object({
  id: z.string().min(1),
  code: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(240),
  model: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1),
  description: z.string().trim().min(1),
  visibility: z.enum(visibilityOptions),
  groupId: z.string().min(1),
  manufacturerId: z.string().min(1),
  supplierName: z.string().trim().max(160).optional(),
  contactPerson: z.string().trim().max(160).optional(),
  sourceWebsite: z.string().trim().max(500).optional(),
  sourceDocumentFolder: z.string().trim().max(500).optional(),
  sourceImageSpecFolder: z.string().trim().max(500).optional(),
});

const createProductFormSchema = productFormSchema.omit({ id: true });

function normalizeOptional(value?: string) {
  return value?.trim() || null;
}

function productAssetDir(productId: string) {
  return path.join(process.cwd(), "public", "product-assets", productId);
}

function productAssetStorageKey(productId: string, fileName: string) {
  return `/product-assets/${productId}/${fileName}`;
}

function safeFileName(value: string) {
  const parsed = path.parse(value);
  const base = slugify(parsed.name) || "image";
  const ext = parsed.ext.toLowerCase();
  return `${base}${ext}`;
}

function isSupportedImage(file: File) {
  return ["image/png", "image/jpeg", "image/webp"].includes(file.type);
}

function parseSpecificationsText(value: FormDataEntryValue | null): ParsedSpecification[] {
  const text = typeof value === "string" ? value : "";
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [name, value, unit] = line.split("|").map((part) => part.trim());
      if (!name || !value) return null;
      return {
        name: name.slice(0, 255),
        value,
        unit: unit ? unit.slice(0, 64) : null,
        sortOrder: index + 1,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

function uploadedSpecificationFile(formData: FormData) {
  const file = formData.get("specificationsFile");
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > maxSpecificationUploadBytes) {
    throw new Error("File thông số kỹ thuật quá lớn. Giới hạn hiện tại là 5MB.");
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    throw new Error("File thông số kỹ thuật phải là file Excel .xlsx.");
  }
  return file;
}

async function getSpecificationsFromForm(formData: FormData) {
  const file = uploadedSpecificationFile(formData);
  if (!file) return parseSpecificationsText(formData.get("specificationsText"));

  const specifications = await parseSpecificationsFromXlsxFile(file);
  if (specifications.length === 0) {
    throw new Error("Không tìm thấy dòng thông số hợp lệ trong file Excel.");
  }
  return specifications;
}

function formatFileCounter(value: number) {
  return value.toString().padStart(2, "0");
}

async function saveUploadedImages(productId: string, files: File[]) {
  const imageFiles = files.filter((file) => file.size > 0);
  if (imageFiles.length === 0) return 0;

  const assetDir = productAssetDir(productId);
  await mkdir(assetDir, { recursive: true });

  const existingAssets = await prisma.asset.findMany({
    where: { productId },
    select: { fileName: true },
  });
  const usedFileNames = new Set(existingAssets.map((asset) => asset.fileName));
  let created = 0;

  for (const file of imageFiles) {
    if (!isSupportedImage(file)) {
      throw new Error(`File "${file.name}" không phải định dạng ảnh được hỗ trợ. Chỉ hỗ trợ PNG, JPG/JPEG, WEBP.`);
    }
    if (file.size > maxImageUploadBytes) {
      throw new Error(`File "${file.name}" quá lớn. Giới hạn hiện tại là 10MB mỗi ảnh.`);
    }

    const safeName = safeFileName(file.name);
    const parsed = path.parse(safeName);
    let fileName = safeName;
    let counter = 2;
    while (usedFileNames.has(fileName)) {
      fileName = `${parsed.name}-${formatFileCounter(counter)}${parsed.ext}`;
      counter += 1;
    }
    usedFileNames.add(fileName);

    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(assetDir, fileName), bytes);

    await prisma.asset.create({
      data: {
        productId,
        title: parsed.name,
        storageKey: productAssetStorageKey(productId, fileName),
        fileName,
        mimeType: file.type,
        size: file.size,
        visibility: Visibility.PUBLIC,
      },
    });
    created += 1;
  }

  return created;
}

async function replaceSpecifications(productId: string, specifications: ParsedSpecification[]) {
  await prisma.specification.deleteMany({ where: { productId } });
  if (specifications.length === 0) return 0;

  await prisma.specification.createMany({
    data: specifications.map((specification) => ({
      productId,
      ...specification,
      visibility: Visibility.PUBLIC,
    })),
  });

  return specifications.length;
}

async function deleteSelectedAssets(productId: string, assetIds: string[]) {
  if (assetIds.length === 0) return 0;

  const assets = await prisma.asset.findMany({
    where: { productId, id: { in: assetIds } },
  });
  if (assets.length === 0) return 0;

  await prisma.asset.deleteMany({
    where: { productId, id: { in: assets.map((asset) => asset.id) } },
  });

  const assetDir = productAssetDir(productId);
  for (const asset of assets) {
    const absolutePath = path.resolve(assetDir, asset.fileName);
    if (!absolutePath.startsWith(path.resolve(assetDir))) continue;
    await unlink(absolutePath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }

  return assets.length;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

async function uniqueProductSlug(name: string, existingProductId?: string) {
  const base = slugify(name) || "san-pham";
  let slug = base;
  let counter = 2;

  while (true) {
    const existing = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (!existing || existing.id === existingProductId) return slug;
    slug = `${base}-${counter}`;
    counter += 1;
  }
}

async function auditProductAction(actorId: string, action: string, productId: string, metadata?: Prisma.InputJsonValue) {
  await writeAuditEvent({
    actorId,
    action,
    entity: "Product",
    entityId: productId,
    metadata: metadata ?? {},
  });
}

export async function createProductAction(formData: FormData) {
  const actor = await requireProductAdmin();
  if (!canEditProducts(actor.role)) {
    throw new Error("Bạn không có quyền thêm sản phẩm.");
  }

  const parsed = createProductFormSchema.parse({
    code: formData.get("code"),
    name: formData.get("name"),
    model: formData.get("model"),
    summary: formData.get("summary"),
    description: formData.get("description"),
    visibility: formData.get("visibility"),
    groupId: formData.get("groupId"),
    manufacturerId: formData.get("manufacturerId"),
    supplierName: formData.get("supplierName") || undefined,
    contactPerson: formData.get("contactPerson") || undefined,
    sourceWebsite: formData.get("sourceWebsite") || undefined,
    sourceDocumentFolder: formData.get("sourceDocumentFolder") || undefined,
    sourceImageSpecFolder: formData.get("sourceImageSpecFolder") || undefined,
  });

  const product = await prisma.product.create({
    data: {
      code: parsed.code,
      slug: await uniqueProductSlug(parsed.name),
      name: parsed.name,
      model: parsed.model,
      summary: parsed.summary,
      description: parsed.description,
      status: ContentStatus.DRAFT,
      visibility: Visibility.INTERNAL,
      featured: false,
      groupId: parsed.groupId,
      manufacturerId: parsed.manufacturerId,
      supplierName: normalizeOptional(parsed.supplierName),
      contactPerson: normalizeOptional(parsed.contactPerson),
      sourceWebsite: normalizeOptional(parsed.sourceWebsite),
      sourceDocumentFolder: normalizeOptional(parsed.sourceDocumentFolder),
      sourceImageSpecFolder: normalizeOptional(parsed.sourceImageSpecFolder),
    },
  });

  const specifications = await getSpecificationsFromForm(formData);
  const [specificationCount, imageCount] = await Promise.all([
    replaceSpecifications(product.id, specifications),
    saveUploadedImages(product.id, formData.getAll("images").filter((item): item is File => item instanceof File)),
  ]);

  await auditProductAction(actor.id, "PRODUCT_CREATE", product.id, {
    status: product.status,
    visibility: product.visibility,
    specificationCount,
    imageCount,
  });

  revalidatePath("/san-pham");
  revalidatePath("/quan-tri/san-pham");
  redirect(`/quan-tri/san-pham/${product.id}`);
}

export async function updateProductAction(formData: FormData) {
  const actor = await requireProductAdmin();
  if (!canEditProducts(actor.role)) {
    throw new Error("Bạn không có quyền sửa sản phẩm.");
  }

  const parsed = productFormSchema.parse({
    id: formData.get("id"),
    code: formData.get("code"),
    name: formData.get("name"),
    model: formData.get("model"),
    summary: formData.get("summary"),
    description: formData.get("description"),
    visibility: formData.get("visibility"),
    groupId: formData.get("groupId"),
    manufacturerId: formData.get("manufacturerId"),
    supplierName: formData.get("supplierName") || undefined,
    contactPerson: formData.get("contactPerson") || undefined,
    sourceWebsite: formData.get("sourceWebsite") || undefined,
    sourceDocumentFolder: formData.get("sourceDocumentFolder") || undefined,
    sourceImageSpecFolder: formData.get("sourceImageSpecFolder") || undefined,
  });

  const before = await prisma.product.findUnique({ where: { id: parsed.id } });
  if (!before) throw new Error("Không tìm thấy sản phẩm.");

  const product = await prisma.product.update({
    where: { id: parsed.id },
    data: {
      code: parsed.code,
      slug: await uniqueProductSlug(parsed.name, parsed.id),
      name: parsed.name,
      model: parsed.model,
      summary: parsed.summary,
      description: parsed.description,
      visibility: parsed.visibility,
      groupId: parsed.groupId,
      manufacturerId: parsed.manufacturerId,
      supplierName: normalizeOptional(parsed.supplierName),
      contactPerson: normalizeOptional(parsed.contactPerson),
      sourceWebsite: normalizeOptional(parsed.sourceWebsite),
      sourceDocumentFolder: normalizeOptional(parsed.sourceDocumentFolder),
      sourceImageSpecFolder: normalizeOptional(parsed.sourceImageSpecFolder),
    },
  });

  const deletedImageCount = await deleteSelectedAssets(
    product.id,
    formData.getAll("deleteAssetId").filter((item): item is string => typeof item === "string"),
  );
  const specifications = await getSpecificationsFromForm(formData);
  const [specificationCount, uploadedImageCount] = await Promise.all([
    replaceSpecifications(product.id, specifications),
    saveUploadedImages(product.id, formData.getAll("images").filter((item): item is File => item instanceof File)),
  ]);

  await auditProductAction(actor.id, "PRODUCT_UPDATE", product.id, {
    before: { status: before.status, visibility: before.visibility },
    after: { status: product.status, visibility: product.visibility },
    specificationCount,
    uploadedImageCount,
    deletedImageCount,
  });

  revalidatePath("/san-pham");
  revalidatePath(`/san-pham/${before.slug}`);
  revalidatePath(`/san-pham/${product.slug}`);
  revalidatePath("/quan-tri/san-pham");
  revalidatePath(`/quan-tri/san-pham/${product.id}`);
  redirect(`/quan-tri/san-pham/${product.id}`);
}

export async function submitProductForReviewAction(formData: FormData) {
  const actor = await requireProductAdmin();
  if (!canEditProducts(actor.role)) {
    throw new Error("Bạn không có quyền gửi duyệt sản phẩm.");
  }

  const id = z.string().min(1).parse(formData.get("id"));
  const product = await prisma.product.update({
    where: { id },
    data: { status: ContentStatus.IN_REVIEW },
  });

  await auditProductAction(actor.id, "PRODUCT_SUBMIT_REVIEW", id, { status: product.status });
  revalidatePath("/quan-tri/san-pham");
  revalidatePath(`/quan-tri/san-pham/${id}`);
}

export async function publishProductAction(formData: FormData) {
  const actor = await requireProductAdmin();
  if (!canApproveProducts(actor.role)) {
    throw new Error("Product Editor không được tự xuất bản. Cần Content Approver duyệt nội dung.");
  }

  const id = z.string().min(1).parse(formData.get("id"));
  const product = await prisma.product.update({
    where: { id },
    data: { status: ContentStatus.PUBLISHED },
  });

  await auditProductAction(actor.id, "PRODUCT_PUBLISH", id, { status: product.status });
  revalidatePath("/san-pham");
  revalidatePath(`/san-pham/${product.slug}`);
  revalidatePath("/quan-tri/san-pham");
  revalidatePath(`/quan-tri/san-pham/${id}`);
}

export async function unpublishProductAction(formData: FormData) {
  const actor = await requireProductAdmin();
  if (!canApproveProducts(actor.role)) {
    throw new Error("Bạn không có quyền gỡ xuất bản sản phẩm.");
  }

  const id = z.string().min(1).parse(formData.get("id"));
  const product = await prisma.product.update({
    where: { id },
    data: { status: ContentStatus.UNPUBLISHED },
  });

  await auditProductAction(actor.id, "PRODUCT_UNPUBLISH", id, { status: product.status });
  revalidatePath("/san-pham");
  revalidatePath(`/san-pham/${product.slug}`);
  revalidatePath("/quan-tri/san-pham");
  revalidatePath(`/quan-tri/san-pham/${id}`);
}

export async function archiveProductAction(formData: FormData) {
  const actor = await requireProductAdmin();
  if (!canApproveProducts(actor.role)) {
    throw new Error("Bạn không có quyền lưu trữ sản phẩm.");
  }

  const id = z.string().min(1).parse(formData.get("id"));
  const product = await prisma.product.update({
    where: { id },
    data: { status: ContentStatus.ARCHIVED, visibility: Visibility.INTERNAL },
  });

  await auditProductAction(actor.id, "PRODUCT_ARCHIVE", id, { status: product.status });
  revalidatePath("/san-pham");
  revalidatePath(`/san-pham/${product.slug}`);
  revalidatePath("/quan-tri/san-pham");
  redirect("/quan-tri/san-pham");
}
