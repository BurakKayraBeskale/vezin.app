"use client";

import UserTable from "@/components/UserTable";

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "EMPLOYEE";
  department: string;
  title: string;
  seniorityLevel: number;
  status: string;
  createdAt: string;
}

interface Props {
  initialUsers: UserRecord[];
  currentUserId: string;
}

export default function UsersPageClient({ initialUsers, currentUserId }: Props) {
  return <UserTable initialUsers={initialUsers} currentUserId={currentUserId} />;
}
