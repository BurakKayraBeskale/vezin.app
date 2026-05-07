import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role: "ADMIN" | "EMPLOYEE";
    department: string;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: "ADMIN" | "EMPLOYEE";
      department: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "ADMIN" | "EMPLOYEE";
    department: string;
  }
}
