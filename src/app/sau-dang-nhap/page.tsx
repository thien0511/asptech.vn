import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { defaultSignedInPath } from "@/lib/navigation";

export default async function AfterSignInPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/dang-nhap");
  }

  redirect(defaultSignedInPath(session.user.role));
}
