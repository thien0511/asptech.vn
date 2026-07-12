"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
    if (response.ok) {
      router.replace("/dang-nhap");
      return;
    }
    const data = await response.json();
    setMessage(response.ok ? "Tạo tài khoản thành công. Bạn có thể đăng nhập." : data.error);
  }
  return <main className="mx-auto grid min-h-screen max-w-6xl place-items-center px-6 py-16"><form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl border bg-white p-8 shadow-sm"><h1 className="text-3xl font-bold">Đăng ký khách hàng</h1>{[ ["name","Họ tên","text"], ["email","Email","email"], ["password","Mật khẩu (tối thiểu 12 ký tự)","password"] ].map(([name,label,type]) => <label key={name} className="block text-sm font-medium">{label}<input name={name} type={type} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>)}<button className="w-full rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white">Tạo tài khoản</button>{message && <p className="text-sm text-slate-700">{message}</p>}<a href="/dang-nhap" className="block text-center text-sm text-blue-700">Quay lại đăng nhập</a></form></main>;
}
