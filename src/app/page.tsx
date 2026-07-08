import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessProductAdmin, canManageUsers } from "@/lib/rbac";
import { defaultSignedInPath } from "@/lib/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { trackPageVisit } from "@/lib/visits";
import { ContentStatus, Visibility } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const capabilities = [
  {
    title: "Thiết bị an ninh và hệ thống chuyên dụng",
    description:
      "Cung cấp, tích hợp và chuyển giao các thiết bị giám sát, phát hiện, kiểm tra an ninh và phương tiện chuyên dụng cho các yêu cầu vận hành nghiêm ngặt.",
  },
  {
    title: "Công nghệ thông tin và kỹ thuật mạng",
    description:
      "Tư vấn, triển khai hạ tầng CNTT, hệ thống mạng máy tính, thiết bị chính hãng và dịch vụ kỹ thuật cho tổ chức, doanh nghiệp và cơ quan nhà nước.",
  },
  {
    title: "Phần mềm và giải pháp ứng dụng",
    description:
      "Phát triển phần mềm theo yêu cầu, hệ thống quản lý dữ liệu, nhận dạng, bảo mật và các nền tảng phục vụ quản lý, đào tạo, phân tích và vận hành.",
  },
];

const milestones = [
  ["2000", "Thành lập tiền thân của ASP"],
  ["2005", "Chuyển đổi thành Công ty Cổ phần Đầu tư và Chuyển giao Công nghệ ASP"],
  ["ISO", "Áp dụng hệ thống quản lý chất lượng ISO 9001"],
  ["2 miền", "Hiện diện tại Hà Nội và TP. Hồ Chí Minh"],
];

function numberFormat(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

export default async function HomePage() {
  await trackPageVisit("/");

  const session = await auth();
  const isSignedIn = Boolean(session?.user);
  const isInternalUser = canAccessProductAdmin(session?.user?.role) || canManageUsers(session?.user?.role);
  const signedInPath = defaultSignedInPath(session?.user?.role);
  const displayName = session?.user?.name || session?.user?.email || "tài khoản";

  const [productCount, publishedPublicCount, groupCount, manufacturerCount, productGroups] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { status: ContentStatus.PUBLISHED, visibility: Visibility.PUBLIC } }),
    prisma.productGroup.count(),
    prisma.manufacturer.count(),
    isInternalUser
      ? prisma.productGroup.findMany({
          include: { _count: { select: { products: true } } },
          orderBy: { products: { _count: "desc" } },
          take: 8,
        })
      : prisma.productGroup.findMany({
          where: { products: { some: { status: ContentStatus.PUBLISHED, visibility: Visibility.PUBLIC } } },
          include: {
            _count: {
              select: { products: { where: { status: ContentStatus.PUBLISHED, visibility: Visibility.PUBLIC } } },
            },
          },
          orderBy: { name: "asc" },
          take: 8,
        }),
  ]);

  const canOpenAdmin = canManageUsers(session?.user?.role) || canAccessProductAdmin(session?.user?.role);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-950/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo-asp.png" alt="ASP Tech" width={46} height={54} priority className="h-12 w-auto" />
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-300">ASP Tech</div>
              <div className="text-xs text-slate-400">asptech.vn</div>
            </div>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
            <a href="#gioi-thieu" className="hover:text-white">Giới thiệu</a>
            <a href="#nang-luc" className="hover:text-white">Năng lực</a>
            <a href="#san-pham" className="hover:text-white">Sản phẩm</a>
            <a href="#lien-he" className="hover:text-white">Liên hệ</a>
          </nav>
          <div className="flex items-center gap-2">
            {canOpenAdmin ? (
              <Link href={signedInPath} className="hidden rounded-full px-4 py-2 text-sm font-semibold text-sky-200 hover:bg-white/10 sm:block">
                Quản trị
              </Link>
            ) : null}
            {isSignedIn ? (
              <span className="hidden max-w-48 truncate text-sm text-slate-300 lg:inline">Xin chào, {displayName}</span>
            ) : null}
            <Link href={isSignedIn ? signedInPath : "/dang-nhap"} className="rounded-full bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-300">
              {isSignedIn ? "Vào hệ thống" : "Đăng nhập"}
            </Link>
            {isSignedIn ? (
              <SignOutButton className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10" />
            ) : null}
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.22),_transparent_32rem)]" />
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
          <div className="relative">
            <div className="inline-flex rounded-full border border-sky-300/30 bg-sky-300/10 px-4 py-2 text-sm font-medium text-sky-200">
              Công nghệ, thiết bị và hệ thống tích hợp
            </div>
            <h1 className="mt-6 max-w-4xl text-4xl font-bold tracking-tight text-white md:text-6xl">
              Đối tác công nghệ cho các hệ thống vận hành yêu cầu độ tin cậy cao.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Công ty Cổ phần Đầu tư và Chuyển giao Công nghệ ASP cung cấp giải pháp phần mềm, hạ tầng CNTT, kỹ thuật mạng,
              thiết bị an ninh và các hệ thống chuyên dụng cho cơ quan, tổ chức và doanh nghiệp.
            </p>
            {isSignedIn ? (
              <p className="mt-4 inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-slate-200">
                Đang đăng nhập: {displayName}
              </p>
            ) : null}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/san-pham" className="rounded-full bg-white px-6 py-3 text-center font-semibold text-slate-950 hover:bg-slate-100">
                Xem danh mục sản phẩm
              </Link>
              {isSignedIn ? (
                <Link href={signedInPath} className="rounded-full border border-white/20 px-6 py-3 text-center font-semibold text-white hover:bg-white/10">
                  Mở trang làm việc
                </Link>
              ) : (
                <Link href="/dang-ky" className="rounded-full border border-white/20 px-6 py-3 text-center font-semibold text-white hover:bg-white/10">
                  Đăng ký tài khoản khách hàng
                </Link>
              )}
            </div>
          </div>

          <div className="relative rounded-[2rem] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
            <div className="rounded-[1.5rem] bg-white p-6 text-slate-950">
              <div className="flex items-start justify-between gap-6">
                <Image src="/logo-asp.png" alt="ASP Tech" width={86} height={102} className="h-24 w-auto" />
                {isInternalUser ? (
                  <div className="text-right">
                    <div className="text-sm text-slate-500">Dashboard nội bộ</div>
                    <div className="text-4xl font-bold">{numberFormat(productCount)}</div>
                    <div className="text-sm text-slate-500">sản phẩm đang quản lý</div>
                  </div>
                ) : (
                  <div className="max-w-xs text-right">
                    <div className="text-sm text-slate-500">ASP Tech</div>
                    <div className="mt-2 text-2xl font-bold">Giải pháp công nghệ và thiết bị tích hợp</div>
                  </div>
                )}
              </div>
              {isInternalUser ? (
                <>
                  <div className="mt-8 grid grid-cols-3 gap-3">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-2xl font-bold">{numberFormat(groupCount)}</div>
                      <div className="mt-1 text-xs text-slate-500">nhóm sản phẩm</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-2xl font-bold">{numberFormat(manufacturerCount)}</div>
                      <div className="mt-1 text-xs text-slate-500">nhà sản xuất</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-2xl font-bold">{numberFormat(publishedPublicCount)}</div>
                      <div className="mt-1 text-xs text-slate-500">đã công khai</div>
                    </div>
                  </div>
                  <p className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                    Dữ liệu nội bộ: sản phẩm Draft/Internal chỉ hiển thị cho tài khoản có quyền nội bộ.
                  </p>
                </>
              ) : (
                <div className="mt-8 rounded-2xl bg-slate-50 p-5">
                  <div className="text-sm font-semibold uppercase tracking-wide text-blue-700">Dành cho khách hàng</div>
                  <p className="mt-3 leading-7 text-slate-600">
                    Truy cập danh mục sản phẩm hoặc đăng ký tài khoản khách hàng để xem thông tin phù hợp.
                  </p>
                  <div className="mt-5 text-sm text-slate-500">Sản phẩm hiện có: {numberFormat(publishedPublicCount)}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section id="gioi-thieu" className="bg-white py-20 text-slate-950">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-700">Giới thiệu</p>
            <h2 className="mt-3 text-3xl font-bold">ASP Tech</h2>
          </div>
          <div className="space-y-5 text-lg leading-8 text-slate-700">
            <p>
              ASP được thành lập từ năm 2000 với định hướng trở thành đơn vị tiên phong trong lĩnh vực công nghệ cao tại Việt Nam.
              Công ty tập trung vào các giải pháp phần mềm, hệ thống mạng máy tính, thiết bị tin học và thiết bị an ninh chuyên dụng.
            </p>
            <p>
              Triết lý vận hành của ASP là lấy chất lượng sản phẩm làm uy tín, lấy sự hài lòng của khách hàng làm thước đo giá trị,
              đồng thời duy trì hợp tác với các nhà sản xuất công nghệ uy tín trên thế giới.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16 text-slate-950">
        <div className="mx-auto grid max-w-7xl gap-4 px-6 md:grid-cols-4">
          {milestones.map(([value, label]) => (
            <div key={value} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-3xl font-bold text-blue-700">{value}</div>
              <div className="mt-2 text-sm leading-6 text-slate-600">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="nang-luc" className="bg-white py-20 text-slate-950">
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-700">Năng lực cốt lõi</p>
            <h2 className="mt-3 text-3xl font-bold">Tư vấn, cung cấp và tích hợp hệ thống từ yêu cầu đến vận hành.</h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {capabilities.map((item) => (
              <div key={item.title} className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <h3 className="text-xl font-bold">{item.title}</h3>
                <p className="mt-4 leading-7 text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="san-pham" className="bg-slate-950 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-300">Danh mục sản phẩm</p>
              <h2 className="mt-3 max-w-3xl text-3xl font-bold">
                {isInternalUser
                  ? "Các nhóm sản phẩm đang được ASP quản lý và chuẩn hóa nội dung."
                  : "Danh mục sản phẩm và giải pháp ASP cung cấp cho khách hàng."}
              </h2>
            </div>
            <Link href="/san-pham" className="rounded-full bg-sky-400 px-5 py-3 text-center font-semibold text-slate-950 hover:bg-sky-300">
              Mở danh mục
            </Link>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {productGroups.map((group) => (
              <Link key={group.id} href={`/san-pham?groupId=${group.id}`} className="rounded-2xl border border-white/10 bg-white/10 p-5 hover:bg-white/15">
                <div className="text-lg font-semibold">{group.name}</div>
                <div className="mt-3 text-sm text-slate-300">{numberFormat(group._count.products)} sản phẩm</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="lien-he" className="bg-white py-20 text-slate-950">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-700">Liên hệ</p>
            <h2 className="mt-3 text-3xl font-bold">Trao đổi nhu cầu sản phẩm hoặc dự án tích hợp.</h2>
            <p className="mt-4 leading-7 text-slate-600">
              {isSignedIn
                ? "Tài khoản của bạn đã đăng nhập. Hãy tiếp tục vào danh mục sản phẩm hoặc trang làm việc phù hợp với quyền được cấp."
                : "Khách hàng có thể đăng ký tài khoản để xem danh mục sản phẩm."}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={isSignedIn ? signedInPath : "/dang-nhap"} className="rounded-full bg-blue-700 px-6 py-3 text-center font-semibold text-white hover:bg-blue-800">
                {isSignedIn ? "Mở trang làm việc" : "Đăng nhập hệ thống"}
              </Link>
              {isSignedIn ? (
                <Link href="/san-pham" className="rounded-full border border-slate-300 px-6 py-3 text-center font-semibold text-slate-900 hover:bg-slate-50">
                  Xem danh mục sản phẩm
                </Link>
              ) : (
                <Link href="/dang-ky" className="rounded-full border border-slate-300 px-6 py-3 text-center font-semibold text-slate-900 hover:bg-slate-50">
                  Đăng ký khách hàng
                </Link>
              )}
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <h3 className="text-xl font-bold">Thông tin liên hệ</h3>
            <dl className="mt-6 space-y-4 text-sm">
              <div>
                <dt className="font-semibold text-slate-900">Văn phòng Hà Nội</dt>
                <dd className="mt-1 text-slate-600">Số 163 phố Khâm Thiên, Quận Đống Đa, TP. Hà Nội</dd>
                <dd className="text-slate-600">Email: info@asptech.vn</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-900">Văn phòng TP. Hồ Chí Minh</dt>
                <dd className="mt-1 text-slate-600">Số 50 Lê Thị Riêng, Quận 1, TP. Hồ Chí Minh</dd>
                <dd className="text-slate-600">Email: hcm@asptech.vn</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-900">Website</dt>
                <dd className="mt-1 text-slate-600">www.asptech.vn</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </main>
  );
}
