import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessProductAdmin } from "@/lib/rbac";
import { SignOutButton } from "@/components/sign-out-button";
import { trackPageVisit } from "@/lib/visits";
import { ContentStatus, Visibility } from "@/generated/prisma/client";

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await trackPageVisit(`/san-pham/${slug}`);

  const session = await auth();
  const canViewInternal = canAccessProductAdmin(session?.user?.role);

  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      group: true,
      assets: {
        where: canViewInternal ? {} : { visibility: Visibility.PUBLIC },
        orderBy: { fileName: "asc" },
      },
      specifications: {
        where: canViewInternal ? {} : { visibility: Visibility.PUBLIC },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!product) notFound();
  const publicAllowed = product.status === ContentStatus.PUBLISHED && product.visibility === Visibility.PUBLIC;
  if (!canViewInternal && !publicAllowed) notFound();
  if (product.status === ContentStatus.ARCHIVED && !canViewInternal) notFound();

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <article className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-4 flex items-center justify-between gap-4 text-sm">
          <Link href="/san-pham" className="font-medium text-blue-700">
            ← Danh mục sản phẩm
          </Link>
          {session?.user ? (
            <div className="flex items-center gap-3">
              <span className="hidden max-w-56 truncate text-slate-500 sm:inline">{session.user.name ?? session.user.email}</span>
              <SignOutButton className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-white hover:text-red-700" />
            </div>
          ) : (
            <Link href="/dang-nhap" className="rounded-lg bg-blue-700 px-3 py-1.5 font-semibold text-white hover:bg-blue-800">
              Đăng nhập
            </Link>
          )}
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="text-sm font-semibold uppercase tracking-wide text-blue-700">{product.group.name}</div>
          <h1 className="mt-2 text-3xl font-bold">{product.name}</h1>
          {product.assets.length > 0 ? (
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {product.assets.map((asset, index) => (
                <div key={asset.id} className="relative h-72 rounded-2xl border border-slate-200 bg-slate-50">
                  <Image
                    src={asset.storageKey}
                    alt={`${product.name} - ${asset.title}`}
                    fill
                    loading={index === 0 ? "eager" : "lazy"}
                    sizes="(min-width: 768px) 50vw, 100vw"
                    className="object-contain p-4"
                  />
                </div>
              ))}
            </div>
          ) : null}
          <div className="mt-8">
            <h2 className="text-lg font-semibold">Mô tả</h2>
            <p className="mt-3 whitespace-pre-line leading-7 text-slate-700">{product.description}</p>
          </div>
          {product.specifications.length > 0 ? (
            <div className="mt-8">
              <h2 className="text-lg font-semibold">Thông số kỹ thuật</h2>
              <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full border-collapse text-left text-sm">
                  <tbody>
                    {product.specifications.map((specification) => (
                      <tr key={specification.id} className="border-b border-slate-100 last:border-0">
                        <th className="w-1/3 bg-slate-50 px-4 py-3 align-top font-semibold text-slate-700">
                          {specification.name}
                        </th>
                        <td className="px-4 py-3 leading-6 text-slate-700">
                          {specification.value}
                          {specification.unit ? ` ${specification.unit}` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>
      </article>
    </main>
  );
}
