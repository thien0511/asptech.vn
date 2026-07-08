import Link from "next/link";
import { createManufacturerAction } from "./actions";
import { prisma } from "@/lib/prisma";
import { canEditProducts, requireProductAdmin } from "@/lib/rbac";

export default async function ManufacturersPage() {
  const user = await requireProductAdmin();
  const canEdit = canEditProducts(user.role);
  const manufacturers = await prisma.manufacturer.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <section>
        <Link href="/quan-tri/san-pham" className="text-sm font-medium text-blue-700">← Quản trị sản phẩm</Link>
        <h2 className="mt-3 text-2xl font-bold">Nhà sản xuất</h2>
        <p className="mt-2 text-sm text-slate-600">Thêm/sửa nhà sản xuất dùng cho danh mục sản phẩm nội bộ.</p>
      </section>

      {canEdit ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Thêm nhà sản xuất</h3>
          <form action={createManufacturerAction} className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_1fr_auto]">
            <input name="name" required placeholder="Tên nhà sản xuất" className="rounded-lg border border-slate-300 px-3 py-2" />
            <input name="country" placeholder="Quốc gia" className="rounded-lg border border-slate-300 px-3 py-2" />
            <input name="website" placeholder="Website" className="rounded-lg border border-slate-300 px-3 py-2" />
            <button className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800">Thêm</button>
          </form>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr><th className="px-5 py-3">Tên</th><th className="px-5 py-3">Quốc gia</th><th className="px-5 py-3">Website</th><th className="px-5 py-3">Sản phẩm</th><th className="px-5 py-3">Thao tác</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {manufacturers.map((manufacturer) => (
              <tr key={manufacturer.id}>
                <td className="px-5 py-4 font-medium">{manufacturer.name}</td>
                <td className="px-5 py-4">{manufacturer.country ?? "—"}</td>
                <td className="px-5 py-4 break-all">{manufacturer.website ?? "—"}</td>
                <td className="px-5 py-4">{manufacturer._count.products}</td>
                <td className="px-5 py-4"><Link href={`/quan-tri/nha-san-xuat/${manufacturer.id}`} className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-50">{canEdit ? "Sửa" : "Xem"}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
