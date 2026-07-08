import Link from "next/link";
import { createProductGroupAction } from "./actions";
import { prisma } from "@/lib/prisma";
import { canEditProducts, requireProductAdmin } from "@/lib/rbac";

export default async function ProductGroupsPage() {
  const user = await requireProductAdmin();
  const canEdit = canEditProducts(user.role);
  const groups = await prisma.productGroup.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <section>
        <Link href="/quan-tri/san-pham" className="text-sm font-medium text-blue-700">← Quản trị sản phẩm</Link>
        <h2 className="mt-3 text-2xl font-bold">Nhóm sản phẩm</h2>
        <p className="mt-2 text-sm text-slate-600">Thêm/sửa ProductGroup dùng cho danh mục sản phẩm.</p>
      </section>

      {canEdit ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Thêm nhóm sản phẩm</h3>
          <form action={createProductGroupAction} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_140px_auto]">
            <input name="name" required placeholder="Tên nhóm" className="rounded-lg border border-slate-300 px-3 py-2" />
            <input name="slug" required placeholder="slug-nhom" className="rounded-lg border border-slate-300 px-3 py-2" />
            <input name="sortOrder" type="number" min={0} defaultValue={0} className="rounded-lg border border-slate-300 px-3 py-2" />
            <button className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800">Thêm</button>
          </form>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3">Tên nhóm</th>
              <th className="px-5 py-3">Slug</th>
              <th className="px-5 py-3">Thứ tự</th>
              <th className="px-5 py-3">Sản phẩm</th>
              <th className="px-5 py-3">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {groups.map((group) => (
              <tr key={group.id}>
                <td className="px-5 py-4 font-medium">{group.name}</td>
                <td className="px-5 py-4 text-slate-600">{group.slug}</td>
                <td className="px-5 py-4">{group.sortOrder}</td>
                <td className="px-5 py-4">{group._count.products}</td>
                <td className="px-5 py-4">
                  <Link href={`/quan-tri/nhom-san-pham/${group.id}`} className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-50">
                    {canEdit ? "Sửa" : "Xem"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
