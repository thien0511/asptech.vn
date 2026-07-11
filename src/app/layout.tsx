import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ASP Tech", template: "%s | ASP Tech" },
  description: "Công ty Cổ phần Đầu tư và Chuyển giao Công nghệ ASP",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
