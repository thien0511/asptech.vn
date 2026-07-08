import Link from "next/link";
import { notFound } from "next/navigation";
import { updateManufacturerAction } from "../actions";
import { prisma } from "@/lib/prisma";
import { canEditProducts, requireProductAdmin } from "@/lib/rbac";

export default async function ManufacturerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireProductAdmin();
  const canEdit = canEditProducts(user.role);
  const { id } = await params;
  const manufacturer = await prisma.manufacturer.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });
  if (!manufacturer) notFound();

  return (
    <div className="space-y-6">
      <Link href="/quan-tri/nha-san-xuat" className="text-sm font-medium text-blue-700">← Danh sách nhà sản xuất</Link>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-bold">{manufacturer.name}</h2>
        <p className="mt-2 text-sm text-slate-600">Đang gắn với {manufacturer._count.products} sản phẩm.</p>
        <form action={updateManufacturerAction} className="mt-6 grid gap-4 md:grid-cols-2">
          <input type="hidden" name="id" value={manufacturer.id} />
          <label className="text-sm font-medium">Tên<input name="name" required defaultValue={manufacturer.name} readOnly={!canEdit} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
          <label className="text-sm font-medium">Quốc gia<input name="country" defaultValue={manufacturer.country ?? ""} readOnly={!canEdit} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
          <label className="text-sm font-medium md:col-span-2">Website<input name="website" defaultValue={manufacturer.website ?? ""} readOnly={!canEdit} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
          {canEdit ? <div className="md:col-span-2"><button className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800">Lưu thay đổi</button></div> : null}
        </form>
      </section>
    </div>
  );
}
