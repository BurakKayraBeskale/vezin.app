import "next-auth";
import { DefaultSession } from "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role: "ADMIN" | "EMPLOYEE" | "MANAGER";
    department: string;
    canViewAllTasks: boolean;
    seniorityLevel: number;
    canViewAllProjects?: boolean;
    overseesDepartment?: string | null;
  }
  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "EMPLOYEE" | "MANAGER";
      department: string;
      canViewAllTasks: boolean;
      seniorityLevel: number;
      canViewAllProjects?: boolean;
      overseesDepartment?: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "ADMIN" | "EMPLOYEE" | "MANAGER";
    department: string;
    canViewAllTasks: boolean;
    seniorityLevel: number;
    canViewAllProjects?: boolean;
    overseesDepartment?: string | null;
  }
}
