import Link from "next/link";
import Image from "next/image";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessProductAdmin } from "@/lib/rbac";
import { SignOutButton } from "@/components/sign-out-button";
import { trackPageVisit } from "@/lib/visits";
import { ContentStatus, Prisma, Visibility } from "@/generated/prisma/client";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function valueOf(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  await trackPageVisit("/san-pham");

  const session = await auth();
  const canViewInternal = canAccessProductAdmin(session?.user?.role);
  const params = await searchParams;
  const q = valueOf(params, "q")?.trim();
  const groupId = valueOf(params, "groupId");

  const where: Prisma.ProductWhereInput = {
    ...(canViewInternal
      ? { status: { not: ContentStatus.ARCHIVED } }
      : { status: ContentStatus.PUBLISHED, visibility: Visibility.PUBLIC }),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(groupId ? { groupId } : {}),
  };

  const [products, groups] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        group: true,
        assets: {
          where: canViewInternal ? {} : { visibility: Visibility.PUBLIC },
          orderBy: { fileName: "asc" },
          take: 1,
        },
        specifications: {
          where: canViewInternal ? {} : { visibility: Visibility.PUBLIC },
          orderBy: { sortOrder: "asc" },
          take: 3,
        },
      },
      orderBy: [{ group: { name: "asc" } }, { name: "asc" }],
      take: 100,
    }),
    prisma.productGroup.findMany({
      where: canViewInternal ? {} : { products: { some: { status: ContentStatus.PUBLISHED, visibility: Visibility.PUBLIC } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
              ASP Tech
            </Link>
            {session?.user ? (
              <div className="flex items-center gap-3 text-sm">
                <span className="hidden max-w-56 truncate text-slate-500 sm:inline">{session.user.name ?? session.user.email}</span>
                <SignOutButton className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 hover:text-red-700" />
              </div>
            ) : (
              <Link href="/dang-nhap" className="rounded-lg bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800">
                Đăng nhập
              </Link>
            )}
          </div>
          <h1 className="mt-3 text-3xl font-bold">Danh mục sản phẩm</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Danh sách sản phẩm và giải pháp ASP cung cấp. Thông tin hiển thị gồm nhóm sản phẩm, tên, mô tả, hình ảnh và
            thông số kỹ thuật cơ bản.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <form className="mb-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_260px_auto]">
          <input
            name="q"
            defaultValue={q}
            placeholder="Tìm theo tên hoặc mô tả"
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
          <select name="groupId" defaultValue={groupId ?? ""} className="rounded-lg border border-slate-300 px-3 py-2">
            <option value="">Tất cả nhóm</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          <button className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800">Lọc</button>
        </form>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product, index) => (
            <Link
              key={product.id}
              href={`/san-pham/${product.slug}`}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              {product.assets[0] ? (
                <div className="relative h-48 w-full bg-slate-100">
                  <Image
                    src={product.assets[0].storageKey}
                    alt={product.name}
                    fill
                    loading={index === 0 ? "eager" : "lazy"}
                    sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                    className="object-contain p-4"
                  />
                </div>
              ) : (
                <div className="flex h-48 items-center justify-center bg-slate-100 px-6 text-center text-sm text-slate-500">
                  Chưa có hình ảnh
                </div>
              )}
              <div className="p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">{product.group.name}</div>
                <h2 className="mt-2 text-lg font-bold">{product.name}</h2>
                <p className="mt-3 line-clamp-4 text-sm leading-6 text-slate-600">{product.description}</p>
                {product.specifications.length > 0 ? (
                  <dl className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                    {product.specifications.map((specification) => (
                      <div key={specification.id} className="grid grid-cols-[120px_1fr] gap-3 text-xs">
                        <dt className="font-medium text-slate-500">{specification.name}</dt>
                        <dd className="line-clamp-2 text-slate-700">
                          {specification.value}
                          {specification.unit ? ` ${specification.unit}` : ""}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </div>
            </Link>
          ))}
        </div>

        {products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
            Chưa có sản phẩm phù hợp với bộ lọc hoặc chưa có sản phẩm được công khai.
          </div>
        ) : null}
      </div>
    </main>
  );
}
