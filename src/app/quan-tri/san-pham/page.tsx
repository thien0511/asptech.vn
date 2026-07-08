import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { canApproveProducts, canEditProducts, requireProductAdmin } from "@/lib/rbac";
import { contentStatusLabels, visibilityLabels } from "@/lib/product-labels";
import { ContentStatus, Prisma, Visibility } from "@/generated/prisma/client";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const statusOptions = Object.values(ContentStatus);
const visibilityOptions = Object.values(Visibility);

function valueOf(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

async function getVisitStats() {
  try {
    return await prisma.pageVisit.findMany({ orderBy: { count: "desc" }, take: 8 });
  } catch {
    return [];
  }
}

export default async function ProductAdminPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireProductAdmin();
  const params = await searchParams;
  const q = valueOf(params, "q")?.trim();
  const status = valueOf(params, "status") as ContentStatus | undefined;
  const visibility = valueOf(params, "visibility") as Visibility | undefined;
  const groupId = valueOf(params, "groupId");

  const where: Prisma.ProductWhereInput = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { contactPerson: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(status && statusOptions.includes(status) ? { status } : {}),
    ...(visibility && visibilityOptions.includes(visibility) ? { visibility } : {}),
    ...(groupId ? { groupId } : {}),
  };

  const [products, groups, totals, visitStats] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { group: true },
      orderBy: [{ updatedAt: "desc" }],
      take: 150,
    }),
    prisma.productGroup.findMany({ orderBy: { name: "asc" } }),
    prisma.product.groupBy({ by: ["status"], _count: { _all: true } }),
    getVisitStats(),
  ]);

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h2 className="text-2xl font-bold">Quản trị sản phẩm</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Role hiện tại: {user.role}. Product Editor được thêm/sửa và gửi duyệt; Content Approver chịu trách nhiệm xuất bản.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {totals.map((item) => (
              <span key={item.status} className="rounded-full bg-white px-3 py-1 text-sm shadow-sm ring-1 ring-slate-200">
                {contentStatusLabels[item.status]}: {item._count._all}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEditProducts(user.role) ? (
            <Link href="/quan-tri/san-pham/them" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
              Thêm sản phẩm
            </Link>
          ) : null}
          <Link href="/quan-tri/nhom-san-pham" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-white">
            Nhóm sản phẩm
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <form className="grid gap-3 md:grid-cols-[1fr_180px_180px_240px_auto]">
          <input
            name="q"
            defaultValue={q}
            placeholder="Tên, mô tả hoặc liên hệ"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select name="status" defaultValue={status ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Tất cả trạng thái</option>
            {statusOptions.map((item) => <option key={item} value={item}>{contentStatusLabels[item]}</option>)}
          </select>
          <select name="visibility" defaultValue={visibility ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Tất cả hiển thị</option>
            {visibilityOptions.map((item) => <option key={item} value={item}>{visibilityLabels[item]}</option>)}
          </select>
          <select name="groupId" defaultValue={groupId ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Tất cả nhóm</option>
            {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
          <button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">Lọc</button>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Sản phẩm</th>
                <th className="px-5 py-3">Nhóm</th>
                <th className="px-5 py-3">Trạng thái</th>
                <th className="px-5 py-3">Hiển thị</th>
                <th className="px-5 py-3">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="px-5 py-4">
                    <div className="font-medium">{product.name}</div>
                    {product.contactPerson ? <div className="text-slate-500">Liên hệ: {product.contactPerson}</div> : null}
                  </td>
                  <td className="px-5 py-4">{product.group.name}</td>
                  <td className="px-5 py-4">{contentStatusLabels[product.status]}</td>
                  <td className="px-5 py-4">{visibilityLabels[product.visibility]}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/quan-tri/san-pham/${product.id}`} className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-50">
                        {canEditProducts(user.role) ? "Sửa" : "Xem"}
                      </Link>
                      <Link href={`/san-pham/${product.slug}`} className="rounded-lg border border-blue-200 px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-50">
                        Preview
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {products.length === 0 ? <div className="p-8 text-center text-slate-500">Không có sản phẩm phù hợp.</div> : null}
      </section>

      {!canApproveProducts(user.role) && canEditProducts(user.role) ? (
        <p className="text-sm text-slate-500">Ghi chú: tài khoản của bạn không có quyền xuất bản sản phẩm.</p>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold">Lượt visit trang</h3>
        <div className="mt-3 grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-4">
          {visitStats.map((visit) => (
            <div key={visit.id} className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
              <span className="truncate text-slate-600">{visit.path}</span>
              <span className="font-semibold">{formatNumber(visit.count)}</span>
            </div>
          ))}
          {visitStats.length === 0 ? <p className="text-slate-500">Chưa có dữ liệu visit.</p> : null}
        </div>
      </section>
    </div>
  );
}
