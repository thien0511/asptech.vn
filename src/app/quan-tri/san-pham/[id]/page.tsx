import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  archiveProductAction,
  publishProductAction,
  submitProductForReviewAction,
  unpublishProductAction,
  updateProductAction,
} from "../actions";
import { prisma } from "@/lib/prisma";
import { canApproveProducts, canEditProducts, requireProductAdmin } from "@/lib/rbac";
import { contentStatusLabels, visibilityLabels } from "@/lib/product-labels";
import { Visibility } from "@/generated/prisma/client";

const visibilityOptions = Object.values(Visibility);

function fieldClass(readOnly: boolean) {
  return `mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 ${readOnly ? "bg-slate-100 text-slate-600" : ""}`;
}

function formatSpecificationsText(specifications: Array<{ name: string; value: string; unit: string | null }>) {
  return specifications
    .map((specification) =>
      [specification.name, specification.value, specification.unit ?? ""]
        .filter((part, index) => index < 2 || part)
        .join(" | "),
    )
    .join("\n");
}

export default async function ProductAdminDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireProductAdmin();
  const { id } = await params;
  const canEdit = canEditProducts(user.role);
  const canApprove = canApproveProducts(user.role);

  const [product, groups, auditEvents] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        group: true,
        assets: { orderBy: { fileName: "asc" } },
        specifications: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.productGroup.findMany({ orderBy: { name: "asc" } }),
    prisma.auditEvent.findMany({
      where: { entity: "Product", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  if (!product) notFound();

  return (
    <div className="space-y-6">
      <Link href="/quan-tri/san-pham" className="text-sm font-medium text-blue-700">
        ← Quay lại danh sách
      </Link>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <h2 className="text-2xl font-bold">{product.name}</h2>
            <p className="mt-1 text-sm text-slate-600">{product.group.name}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-800">{contentStatusLabels[product.status]}</span>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{visibilityLabels[product.visibility]}</span>
            </div>
          </div>
          <Link
            href={`/san-pham/${product.slug}`}
            className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            Preview
          </Link>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Nội dung sản phẩm</h3>
          <form action={updateProductAction} className="mt-4 grid gap-4 md:grid-cols-2">
            <input type="hidden" name="id" value={product.id} />
            <label className="text-sm font-medium md:col-span-2">
              Tên sản phẩm
              <input name="name" defaultValue={product.name} readOnly={!canEdit} className={fieldClass(!canEdit)} />
            </label>
            <label className="text-sm font-medium">
              Visibility
              <select name="visibility" defaultValue={product.visibility} disabled={!canEdit} className={fieldClass(!canEdit)}>
                {visibilityOptions.map((item) => (
                  <option key={item} value={item}>{visibilityLabels[item]}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Nhóm sản phẩm
              <select name="groupId" defaultValue={product.groupId} disabled={!canEdit} className={fieldClass(!canEdit)}>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium md:col-span-2">
              Mô tả
              <textarea name="description" defaultValue={product.description} readOnly={!canEdit} rows={8} className={fieldClass(!canEdit)} />
            </label>
            <label className="text-sm font-medium md:col-span-2">
              Liên hệ
              <input name="contactPerson" defaultValue={product.contactPerson ?? ""} readOnly={!canEdit} className={fieldClass(!canEdit)} />
            </label>

            <div className="md:col-span-2">
              <div className="text-sm font-medium">Hình ảnh sản phẩm</div>
              {product.assets.length > 0 ? (
                <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {product.assets.map((asset) => (
                    <div key={asset.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="relative h-40 rounded-xl bg-white">
                        <Image
                          src={asset.storageKey}
                          alt={asset.title}
                          fill
                          sizes="(min-width: 1280px) 240px, (min-width: 640px) 50vw, 100vw"
                          className="object-contain p-2"
                        />
                      </div>
                      <div className="mt-2 truncate text-xs text-slate-600">{asset.fileName}</div>
                      {canEdit ? (
                        <label className="mt-2 flex items-center gap-2 text-xs text-red-700">
                          <input type="checkbox" name="deleteAssetId" value={asset.id} />
                          Xóa ảnh này khi lưu
                        </label>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">Chưa có hình ảnh.</p>
              )}
              {canEdit ? (
                <label className="mt-4 block text-sm font-medium">
                  Upload thêm ảnh
                  <input name="images" type="file" accept="image/png,image/jpeg,image/webp" multiple className={fieldClass(false)} />
                  <span className="mt-1 block text-xs font-normal text-slate-500">
                    Có thể chọn nhiều ảnh PNG, JPG/JPEG hoặc WEBP. Ảnh mới sẽ được thêm vào danh sách hiện có.
                  </span>
                </label>
              ) : null}
            </div>

            <label className="text-sm font-medium md:col-span-2">
              Thông số kỹ thuật
              {canEdit ? (
                <>
                  <input
                    name="specificationsFile"
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className={fieldClass(false)}
                  />
                  <span className="mt-1 block text-xs font-normal text-slate-500">
                    Có thể upload file Excel .xlsx. File có thể có một hoặc nhiều sheet; mỗi sheet dùng 2 cột: tên thông số và giá trị.
                    Nếu có upload Excel, hệ thống sẽ ưu tiên dữ liệu từ file này và ghi đè danh sách thông số hiện tại.
                  </span>
                </>
              ) : null}
              <textarea
                name="specificationsText"
                defaultValue={formatSpecificationsText(product.specifications)}
                readOnly={!canEdit}
                rows={12}
                placeholder={"Mỗi dòng một thông số, định dạng: Tên thông số | Giá trị | Đơn vị"}
                className={fieldClass(!canEdit)}
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                Nếu không upload Excel, danh sách thông số hiện tại sẽ được cập nhật theo nội dung ô này. Cột đơn vị là tùy chọn.
              </span>
            </label>

            {canEdit ? (
              <div className="md:col-span-2">
                <button className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800">
                  Lưu nội dung
                </button>
              </div>
            ) : null}
          </form>
        </div>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Workflow</h3>
            <div className="mt-4 space-y-3">
              {canEdit ? (
                <form action={submitProductForReviewAction}>
                  <input type="hidden" name="id" value={product.id} />
                  <button className="w-full rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">
                    Gửi duyệt
                  </button>
                </form>
              ) : null}
              {canApprove ? (
                <>
                  <form action={publishProductAction}>
                    <input type="hidden" name="id" value={product.id} />
                    <button className="w-full rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
                      Xuất bản
                    </button>
                  </form>
                  <form action={unpublishProductAction}>
                    <input type="hidden" name="id" value={product.id} />
                    <button className="w-full rounded-lg border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50">
                      Gỡ xuất bản
                    </button>
                  </form>
                  <form action={archiveProductAction}>
                    <input type="hidden" name="id" value={product.id} />
                    <button className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50">
                      Lưu trữ
                    </button>
                  </form>
                </>
              ) : (
                <p className="text-sm text-slate-500">Tài khoản này không có quyền xuất bản/gỡ xuất bản.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Audit gần đây</h3>
            <div className="mt-4 space-y-3">
              {auditEvents.map((event) => (
                <div key={event.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                  <div className="font-medium">{event.action}</div>
                  <div className="text-slate-500">{event.createdAt.toLocaleString("vi-VN")}</div>
                </div>
              ))}
              {auditEvents.length === 0 ? <p className="text-sm text-slate-500">Chưa có audit.</p> : null}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
