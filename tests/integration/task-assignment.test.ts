/**
 * getEligibleAssignees / isEligibleAssignee entegrasyon testleri — A BLOĞU
 *
 * lib/task-assignment.ts — "kime görev atanabilir" tek doğru kaynağı.
 *
 * Kapsanan senaryolar:
 *   TA1  Eşit kıdemli hedef listede dönmez (KESİN büyük kural)
 *   TA2  Pasif (INACTIVE) kullanıcı listede dönmez
 *   TA3  Projeli görevde, projenin aktif üyesi olmayan hedef listede dönmez
 *   TA4  Projesiz görevde, yalnızca görevin departmanındaki hedefler döner
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import { getEligibleAssignees, isEligibleAssignee } from "../../lib/task-assignment";

const prisma = new PrismaClient();
const hash = (pw: string) => bcrypt.hash(pw, 10);
const PREFIX = `test-ta-${Date.now()}`;
const email = (slug: string) => `${PREFIX}-${slug}@ta.test`;

const createdUserIds: string[] = [];
const createdProjectIds: string[] = [];

let assigner: { id: string; email: string };       // level 8, BAGIMSIZ_DENETIM
let sameLevel: { id: string; email: string };       // level 8 — eşit kıdem
let lowerLevel: { id: string; email: string };      // level 3, BAGIMSIZ_DENETIM — geçerli hedef
let inactiveLower: { id: string; email: string };   // level 2, status INACTIVE
let otherDeptLower: { id: string; email: string };  // level 2, OUTSOURCE — projesiz görevde departman dışı
let projMemberLower: { id: string; email: string }; // level 2 — projenin üyesi
let nonMemberLower: { id: string; email: string };  // level 2 — aynı departman ama projeye üye değil

let projectId: string;

beforeAll(async () => {
  async function mkUser(
    slug: string,
    level: number,
    dept: string,
    status: "ACTIVE" | "INACTIVE" = "ACTIVE"
  ) {
    const u = await prisma.user.create({
      data: {
        name: `${PREFIX} ${slug}`,
        email: email(slug),
        password: await hash("test123"),
        role: "EMPLOYEE",
        department: dept,
        seniorityLevel: level,
        canViewAllProjects: false,
        overseesDepartment: null,
        canViewAllTasks: false,
        canBeAssignedTasks: true,
        status,
      },
    });
    createdUserIds.push(u.id);
    return { id: u.id, email: u.email };
  }

  assigner        = await mkUser("assigner",   8, "BAGIMSIZ_DENETIM");
  sameLevel       = await mkUser("samelevel",  8, "BAGIMSIZ_DENETIM");
  lowerLevel      = await mkUser("lower",      3, "BAGIMSIZ_DENETIM");
  inactiveLower   = await mkUser("inactive",   2, "BAGIMSIZ_DENETIM", "INACTIVE");
  otherDeptLower  = await mkUser("otherdept",  2, "OUTSOURCE");
  projMemberLower = await mkUser("projmember", 2, "BAGIMSIZ_DENETIM");
  nonMemberLower  = await mkUser("nonmember",  2, "BAGIMSIZ_DENETIM");

  const proj = await prisma.project.create({
    data: { name: `${PREFIX} Proje`, department: "BAGIMSIZ_DENETIM", createdById: assigner.id },
  });
  projectId = proj.id;
  createdProjectIds.push(proj.id);

  await prisma.projectMember.create({
    data: { projectId, userId: projMemberLower.id, assignedBy: assigner.id },
  });
});

afterAll(async () => {
  await prisma.projectMember.deleteMany({ where: { projectId: { in: createdProjectIds } } });
  await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

function assignerArg() {
  return { id: assigner.id, role: "EMPLOYEE", seniorityLevel: 8, canViewAllProjects: false, email: assigner.email };
}

describe("TA1 — eşit kıdemli hedef listede dönmez", () => {
  it("aynı seviyedeki (8) kullanıcı eligible listesinde yok", async () => {
    const eligible = await getEligibleAssignees(assignerArg(), {});
    const ids = eligible.map((u) => u.id);
    expect(ids).not.toContain(sameLevel.id);
    expect(ids).toContain(lowerLevel.id);
  });

  it("isEligibleAssignee — eşit kıdemli hedef için false döner", async () => {
    expect(await isEligibleAssignee(assignerArg(), sameLevel.id, {})).toBe(false);
    expect(await isEligibleAssignee(assignerArg(), lowerLevel.id, {})).toBe(true);
  });
});

describe("TA2 — pasif (INACTIVE) kullanıcı listede dönmez", () => {
  it("status=INACTIVE kullanıcı eligible listesinde yok", async () => {
    const eligible = await getEligibleAssignees(assignerArg(), {});
    const ids = eligible.map((u) => u.id);
    expect(ids).not.toContain(inactiveLower.id);
  });
});

describe("TA3 — projeli görevde proje üyesi olmayan hedef listede dönmez", () => {
  it("projenin üyesi → listede var, üyesi olmayan → listede yok", async () => {
    const eligible = await getEligibleAssignees(assignerArg(), { projectId });
    const ids = eligible.map((u) => u.id);
    expect(ids).toContain(projMemberLower.id);
    expect(ids).not.toContain(nonMemberLower.id);
  });

  it("isEligibleAssignee — proje üyesi olmayan hedef için false döner", async () => {
    expect(await isEligibleAssignee(assignerArg(), nonMemberLower.id, { projectId })).toBe(false);
    expect(await isEligibleAssignee(assignerArg(), projMemberLower.id, { projectId })).toBe(true);
  });
});

describe("TA4 — projesiz görevde yalnızca görevin departmanındaki hedefler döner", () => {
  it("aynı departmandaki hedef listede var, farklı departmandaki yok", async () => {
    const eligible = await getEligibleAssignees(assignerArg(), { departmentId: "BAGIMSIZ_DENETIM" });
    const ids = eligible.map((u) => u.id);
    expect(ids).toContain(lowerLevel.id);
    expect(ids).not.toContain(otherDeptLower.id);
  });

  it("isEligibleAssignee — farklı departmandaki hedef için false döner", async () => {
    expect(await isEligibleAssignee(assignerArg(), otherDeptLower.id, { departmentId: "BAGIMSIZ_DENETIM" })).toBe(false);
  });
});
