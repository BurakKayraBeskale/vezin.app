/**
 * GET /api/dashboard/people — "Görüntülenen Personel" seçicisinin seçenekleri.
 * Kural: lib/dashboard/people.ts → getDashboardSelectableUsers (viewer ilk sırada).
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDashboardSelectableUsers, loadDashboardViewer } from "@/lib/dashboard/people";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
  if (!sessionUserId) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const viewer = await loadDashboardViewer(sessionUserId);
  if (!viewer) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const people = await getDashboardSelectableUsers(viewer);
  return NextResponse.json({ people }, { headers: { "Cache-Control": "private, no-store" } });
}
