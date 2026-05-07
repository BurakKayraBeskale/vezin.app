"use client";

import { useMemo } from "react";
import clsx from "clsx";

const DEPT_LABELS: Record<string, string> = {
  OUTSOURCE:            "Outsource",
  BAGIMSIZ_DENETIM:     "Bağımsız Denetim",
  MUHASEBE:             "Muhasebe",
  YEMINLI_MALI_MUSAVIR: "YMM",
  ADMIN:                "Yönetim",
};

const DEPT_COLORS: Record<string, string> = {
  OUTSOURCE:            "#6B7280",
  BAGIMSIZ_DENETIM:     "#6366F1",
  MUHASEBE:             "#10B981",
  YEMINLI_MALI_MUSAVIR: "#F57C28",
  ADMIN:                "#EF4444",
};

export interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "EMPLOYEE";
  department: string;
  createdAt: string;
  taskCount?: number;
  subordinateIds: string[]; // sadece SUBORDINATE tipi (org chart için)
  relations: Array<{ userId: string; relationType: string }>; // tüm ilişkiler
}

interface TreeNode {
  user: OrgUser;
  children: TreeNode[];
}

function buildTree(users: OrgUser[]): TreeNode[] {
  const userMap = new Map(users.map((u) => [u.id, u]));
  const allSubordinateIds = new Set(users.flatMap((u) => u.subordinateIds));

  // Roots: users who are not a subordinate of anyone
  const roots = users.filter((u) => !allSubordinateIds.has(u.id));

  function buildNode(user: OrgUser, visited = new Set<string>()): TreeNode {
    if (visited.has(user.id)) return { user, children: [] };
    visited.add(user.id);
    const children = user.subordinateIds
      .map((id) => userMap.get(id))
      .filter((u): u is OrgUser => !!u)
      .map((u) => buildNode(u, new Set(visited)));
    return { user, children };
  }

  return roots.map((u) => buildNode(u));
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function UserCard({ node, depth }: { node: TreeNode; depth: number }) {
  const { user } = node;
  const deptColor = DEPT_COLORS[user.department] ?? "#6B7280";
  const deptLabel = DEPT_LABELS[user.department] ?? user.department;

  return (
    <div className="flex flex-col items-center">
      {/* Card */}
      <div
        className={clsx(
          "bg-white border-2 rounded-2xl shadow-sm p-3 flex flex-col items-center gap-1.5 w-36 sm:w-40 transition-shadow hover:shadow-md"
        )}
        style={{ borderColor: deptColor + "40" }}
      >
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{ backgroundColor: deptColor }}
        >
          {initials(user.name)}
        </div>
        <p className="text-xs font-bold text-gray-800 text-center leading-snug">{user.name}</p>
        <span
          className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: deptColor + "20", color: deptColor }}
        >
          {deptLabel}
        </span>
        {user.role === "ADMIN" && (
          <span className="text-[9px] font-bold bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full">
            Admin
          </span>
        )}
        {user.taskCount != null && user.taskCount > 0 && (
          <span className="text-[9px] text-gray-400">{user.taskCount} görev</span>
        )}
      </div>

      {/* Children */}
      {node.children.length > 0 && (
        <div className="flex flex-col items-center">
          {/* Vertical line down */}
          <div className="w-px h-5 bg-gray-200" />
          {/* Horizontal connector */}
          {node.children.length > 1 && (
            <div
              className="h-px bg-gray-200"
              style={{ width: `${node.children.length * 160 - 16}px` }}
            />
          )}
          <div className="flex items-start gap-4">
            {node.children.map((child) => (
              <div key={child.user.id} className="flex flex-col items-center">
                <div className="w-px h-5 bg-gray-200" />
                <UserCard node={child} depth={depth + 1} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrgChart({ users }: { users: OrgUser[] }) {
  const tree = useMemo(() => buildTree(users), [users]);

  // Users not in any tree (no manager, no subordinates set — standalone)
  const allSubIds = new Set(users.flatMap((u) => u.subordinateIds));
  const inTree = new Set<string>();
  function collectIds(node: TreeNode) {
    inTree.add(node.user.id);
    node.children.forEach(collectIds);
  }
  tree.forEach(collectIds);
  const standalone = users.filter((u) => !inTree.has(u.id));

  if (users.length === 0) {
    return (
      <div className="py-16 text-center text-gray-400 text-sm">Kullanıcı bulunamadı</div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 justify-end">
        {Object.entries(DEPT_LABELS).map(([key, label]) => (
          <span key={key} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: DEPT_COLORS[key] }} />
            {label}
          </span>
        ))}
      </div>

      {/* Tree(s) */}
      <div className="overflow-x-auto pb-6">
        {tree.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">
            Henüz hiyerarşi tanımlanmamış. "Kullanıcılar" sekmesinde bağlı kişileri ayarlayın.
          </p>
        ) : (
          <div className="flex flex-wrap gap-12 justify-center min-w-max mx-auto px-4">
            {tree.map((root) => (
              <UserCard key={root.user.id} node={root} depth={0} />
            ))}
          </div>
        )}
      </div>

      {/* Standalone users (no hierarchy) */}
      {standalone.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 px-1">
            Hiyerarşi Dışı Kullanıcılar
          </p>
          <div className="flex flex-wrap gap-4">
            {standalone.map((u) => {
              const color = DEPT_COLORS[u.department] ?? "#6B7280";
              return (
                <div
                  key={u.id}
                  className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    {initials(u.name)}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{u.name}</p>
                    <p className="text-[10px] text-gray-400">{DEPT_LABELS[u.department] ?? u.department}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
