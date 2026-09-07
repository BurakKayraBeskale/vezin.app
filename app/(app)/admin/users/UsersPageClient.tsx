"use client";

import UserTable from "@/components/UserTable";

interface UserForList {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "EMPLOYEE";
  department: string;
  createdAt: string;
  taskCount?: number;
  subordinateIds: string[];
  relations: Array<{ userId: string; relationType: string }>;
}

interface Props {
  initialUsers: UserForList[];
  currentUserId: string;
}

export default function UsersPageClient({ initialUsers, currentUserId }: Props) {
  return <UserTable initialUsers={initialUsers} currentUserId={currentUserId} />;
}
