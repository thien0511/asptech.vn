import Link from "next/link";
import { notFound } from "next/navigation";
import { updateProductGroupAction } from "../actions";
import { prisma } from "@/lib/prisma";
import { canEditProducts, requireProductAdmin } from "@/lib/rbac";

export default async function ProductGroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireProductAdmin();
  const canEdit = canEditProducts(user.role);
  const { id } = await params;
  const group = await prisma.productGroup.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });
  if (!group) notFound();

  return (
    <div className="space-y-6">
      <Link href="/quan-tri/nhom-san-pham" className="text-sm font-medium text-blue-700">← Danh sách nhóm sản phẩm</Link>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-bold">{group.name}</h2>
        <p className="mt-2 text-sm text-slate-600">Đang gắn với {group._count.products} sản phẩm.</p>
        <form action={updateProductGroupAction} className="mt-6 grid gap-4 md:grid-cols-2">
          <input type="hidden" name="id" value={group.id} />
          <label className="text-sm font-medium">
            Tên nhóm
            <input name="name" required defaultValue={group.name} readOnly={!canEdit} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm font-medium">
            Slug
            <input name="slug" required defaultValue={group.slug} readOnly={!canEdit} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm font-medium">
            Thứ tự hiển thị
            <input name="sortOrder" type="number" min={0} required defaultValue={group.sortOrder} readOnly={!canEdit} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          {canEdit ? <div className="md:col-span-2"><button className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800">Lưu thay đổi</button></div> : null}
        </form>
      </section>
    </div>
  );
}
