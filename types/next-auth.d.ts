import "next-auth";
import { DefaultSession } from "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role: "ADMIN" | "EMPLOYEE";
    department: string;
    canViewAllTasks: boolean;
    seniorityLevel: number;
    canViewAllProjects?: boolean;
    overseesDepartment?: string | null;
    canManageCompanies?: boolean;
    status?: string;
  }
  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "EMPLOYEE";
      department: string;
      canViewAllTasks: boolean;
      seniorityLevel: number;
      canViewAllProjects?: boolean;
      overseesDepartment?: string | null;
      canManageCompanies?: boolean;
      status?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "ADMIN" | "EMPLOYEE";
    department: string;
    canViewAllTasks: boolean;
    seniorityLevel: number;
    canViewAllProjects?: boolean;
    overseesDepartment?: string | null;
    canManageCompanies?: boolean;
    status?: string;
  }
}
