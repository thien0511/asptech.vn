import Link from "next/link";
import { createProductAction } from "../actions";
import { prisma } from "@/lib/prisma";
import { canEditProducts, requireProductAdmin } from "@/lib/rbac";
import { visibilityLabels } from "@/lib/product-labels";
import { Visibility } from "@/generated/prisma/client";

const visibilityOptions = Object.values(Visibility);

function inputClass() {
  return "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2";
}

export default async function CreateProductPage() {
  const user = await requireProductAdmin();
  if (!canEditProducts(user.role)) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-bold">Không có quyền thêm sản phẩm</h2>
        <p className="mt-2 text-slate-600">Tài khoản hiện tại chỉ có quyền xem.</p>
      </div>
    );
  }

  const groups = await prisma.productGroup.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <Link href="/quan-tri/san-pham" className="text-sm font-medium text-blue-700">
        ← Quay lại danh sách
      </Link>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-bold">Thêm sản phẩm</h2>
        <p className="mt-2 text-sm text-slate-600">Sản phẩm mới sẽ mặc định ở trạng thái Nháp / Nội bộ.</p>
        <form action={createProductAction} className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium md:col-span-2">
            Tên sản phẩm
            <input name="name" required className={inputClass()} />
          </label>
          <label className="text-sm font-medium">
            Visibility
            <select name="visibility" defaultValue={Visibility.INTERNAL} className={inputClass()}>
              {visibilityOptions.map((item) => (
                <option key={item} value={item}>{visibilityLabels[item]}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Nhóm sản phẩm
            <select name="groupId" required className={inputClass()}>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium md:col-span-2">
            Mô tả
            <textarea name="description" required rows={8} className={inputClass()} />
          </label>
          <label className="text-sm font-medium md:col-span-2">
            Liên hệ
            <input name="contactPerson" className={inputClass()} />
          </label>
          <label className="text-sm font-medium md:col-span-2">
            Hình ảnh sản phẩm
            <input name="images" type="file" accept="image/png,image/jpeg,image/webp" multiple className={inputClass()} />
            <span className="mt-1 block text-xs font-normal text-slate-500">Có thể chọn nhiều ảnh PNG, JPG/JPEG hoặc WEBP.</span>
          </label>
          <label className="text-sm font-medium md:col-span-2">
            Thông số kỹ thuật
            <input name="specificationsFile" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className={inputClass()} />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Có thể upload file Excel .xlsx. File có thể có một hoặc nhiều sheet; mỗi sheet dùng 2 cột: tên thông số và giá trị.
              Nếu có upload Excel, hệ thống sẽ ưu tiên dữ liệu từ file này.
            </span>
            <textarea
              name="specificationsText"
              rows={8}
              placeholder={"Mỗi dòng một thông số, định dạng: Tên thông số | Giá trị | Đơn vị\nVí dụ: Công suất định mức | 500 | W"}
              className={inputClass()}
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Nếu không upload Excel, có thể nhập tay tại đây. Cột đơn vị là tùy chọn.
            </span>
          </label>
          <div className="md:col-span-2">
            <button className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800">Tạo sản phẩm</button>
          </div>
        </form>
      </section>
    </div>
  );
}
