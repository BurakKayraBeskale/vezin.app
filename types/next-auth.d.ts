import "next-auth";
import { DefaultSession } from "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role: "ADMIN" | "EMPLOYEE" | "MANAGER";
    department: string;
  }
  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "EMPLOYEE" | "MANAGER";
      department: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "ADMIN" | "EMPLOYEE" | "MANAGER";
    department: string;
  }
}
