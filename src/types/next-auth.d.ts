import { DefaultSession } from "next-auth";
import { Role, UserStatus } from "@/generated/prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      status: UserStatus;
      mustChangePassword?: boolean;
      accessExpiresAt?: string;
      revoked?: boolean;
    } & DefaultSession["user"];
  }
  interface User { role?: Role }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    status?: UserStatus;
    mustChangePassword?: boolean;
    accessExpiresAt?: string;
    sessionVersion?: number;
    revoked?: boolean;
  }
}
