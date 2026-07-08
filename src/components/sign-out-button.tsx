import { signOut } from "@/auth";

type SignOutButtonProps = {
  className?: string;
  label?: string;
};

export function SignOutButton({ className, label = "Đăng xuất" }: SignOutButtonProps) {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}
