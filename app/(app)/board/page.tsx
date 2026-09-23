import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth";
import { fetchBoardData, BoardFilters } from "@/lib/task-board";
import { getPerformanceScope } from "@/lib/access";
import TaskBoard from "@/components/board/TaskBoard";
import PerformancePanel from "@/components/PerformancePanel";

export const dynamic = "force-dynamic";

const VIEW_COOKIE = "vezin-board-view";

export default async function BoardPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user.role === "ADMIN";
  const userId = session!.user.id;
  const role = session!.user.role;
  const canViewAllTasks = (session!.user as any).canViewAllTasks ?? false;
  const canViewAllProjects = (session!.user as any).canViewAllProjects ?? false;
  const overseesDepartment = (session!.user as any).overseesDepartment as string | null ?? null;
  const department = (session!.user as any).department as string ?? "";
  const seniorityLevel = (session!.user as any).seniorityLevel as number ?? 0;
  const userEmail = session!.user.email ?? "";
  // Görev oluşturma yetkisi — eski board'daki aynı geniş bayrak (Task Core'un
  // kendi POST /api/tasks kuralları zaten bağımsız olarak da uygulanır).
  const canCreate = isAdmin || canViewAllTasks;
  const performanceScope = getPerformanceScope({ role, email: userEmail });

  // #11: son seçilen hızlı görünüm — tarayıcı çerezinden hatırlanır, yoksa "Bana Atananlar"
  const storedView = cookies().get(VIEW_COOKIE)?.value;
  const initialFilters: BoardFilters = {
    view: storedView === "given" || storedView === "all" ? storedView : "mine",
    q: "",
    projectId: "",
    personId: "",
    priority: "",
    overdue: "",
    department: "",
    completedRange: "30d",
  };

  const boardUser = { id: userId, role, department, seniorityLevel, canViewAllProjects, overseesDepartment, isAdmin };
  const initialData = await fetchBoardData(boardUser, initialFilters);

  return (
    <div className="max-w-screen-2xl mx-auto">
      <TaskBoard
        initialData={JSON.parse(JSON.stringify(initialData))}
        initialFilters={initialFilters}
        currentUserId={userId}
        userIdentity={{ id: userId, role, seniorityLevel, canViewAllProjects, overseesDepartment, department }}
        isAdmin={isAdmin}
        canCreate={canCreate}
      />

      {performanceScope && <PerformancePanel />}
    </div>
  );
}
