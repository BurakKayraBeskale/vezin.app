import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hash = (pw: string) => bcrypt.hash(pw, 10);

  // ── Kullanıcılar ──────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: "admin@vezin.com" },
    update: { department: "ADMIN" },
    create: {
      name: "Admin Vezin",
      email: "admin@vezin.com",
      password: await hash("vezin123"),
      role: "ADMIN",
      department: "ADMIN",
    },
  });

  const ayse = await prisma.user.upsert({
    where: { email: "ayse.kaya@vezin.com" },
    update: { department: "MUHASEBE" },
    create: {
      name: "Ayşe Kaya",
      email: "ayse.kaya@vezin.com",
      password: await hash("vezin123"),
      role: "EMPLOYEE",
      department: "MUHASEBE",
    },
  });

  const murat = await prisma.user.upsert({
    where: { email: "murat.demir@vezin.com" },
    update: { department: "OUTSOURCE" },
    create: {
      name: "Murat Demir",
      email: "murat.demir@vezin.com",
      password: await hash("vezin123"),
      role: "EMPLOYEE",
      department: "OUTSOURCE",
    },
  });

  const zeynep = await prisma.user.upsert({
    where: { email: "zeynep.celik@vezin.com" },
    update: { department: "BAGIMSIZ_DENETIM" },
    create: {
      name: "Zeynep Çelik",
      email: "zeynep.celik@vezin.com",
      password: await hash("vezin123"),
      role: "EMPLOYEE",
      department: "BAGIMSIZ_DENETIM",
    },
  });

  // ── Görevler ──────────────────────────────────────────
  const now = new Date();
  const days = (n: number) => new Date(now.getTime() + n * 86400000);

  const tasks = [
    {
      title: "2024 Kurumlar Vergisi Beyannamesi Hazırlama",
      description: "Alfa Holding A.Ş. için Q4 2024 kurumlar vergisi beyannamesi hazırlanacak.",
      status: "IN_PROGRESS" as const,
      priority: "HIGH" as const,
      assignedToId: ayse.id,
      dueDate: days(9),
      createdById: admin.id,
    },
    {
      title: "KDV İadesi Dosyası İnceleme",
      description: "Beta İnşaat Ltd. Mart ayı KDV iadesi için gerekli evraklar incelenecek.",
      status: "REVIEW" as const,
      priority: "HIGH" as const,
      assignedToId: murat.id,
      dueDate: days(2),
      createdById: admin.id,
    },
    {
      title: "Bağımsız Denetim Raporu - Q1 2026",
      description: "Gamma Tekstil A.Ş. Q1 2026 bağımsız denetim raporu hazırlanacak.",
      status: "IN_PROGRESS" as const,
      priority: "HIGH" as const,
      assignedToId: zeynep.id,
      dueDate: days(14),
      createdById: admin.id,
    },
    {
      title: "Transfer Fiyatlandırması Dokümantasyonu",
      description: "Delta Enerji A.Ş. 2025 yılı transfer fiyatlandırması raporu.",
      status: "TODO" as const,
      priority: "MEDIUM" as const,
      assignedToId: murat.id,
      dueDate: days(24),
      createdById: admin.id,
    },
    {
      title: "SGK Prim Borç Yapılandırması",
      description: "Epsilon Lojistik Ltd. SGK borç yapılandırma başvurusu ve takibi.",
      status: "DONE" as const,
      priority: "HIGH" as const,
      assignedToId: ayse.id,
      dueDate: days(-1),
      createdById: admin.id,
    },
    {
      title: "Mali Tablo Analizi ve Raporlama",
      description: "Zeta Gıda A.Ş. 2025 yıl sonu mali tabloları analizi.",
      status: "DONE" as const,
      priority: "MEDIUM" as const,
      assignedToId: zeynep.id,
      dueDate: days(-2),
      createdById: admin.id,
    },
    {
      title: "Vergi Riski Değerlendirme Raporu",
      description: "Eta Teknoloji A.Ş. vergi risk profili değerlendirilecek.",
      status: "TODO" as const,
      priority: "MEDIUM" as const,
      assignedToId: murat.id,
      dueDate: days(19),
      createdById: admin.id,
    },
    {
      title: "Stopaj Vergisi Beyannamesi",
      description: "Alfa Holding A.Ş. Mart ayı muhtasar beyannamesi.",
      status: "REVIEW" as const,
      priority: "HIGH" as const,
      assignedToId: ayse.id,
      dueDate: days(1),
      createdById: admin.id,
    },
    {
      title: "İç Denetim Süreci Tasarımı",
      description: "Iota Perakende A.Ş. iç kontrol ve denetim süreçleri tasarımı.",
      status: "TODO" as const,
      priority: "MEDIUM" as const,
      assignedToId: zeynep.id,
      dueDate: days(29),
      createdById: admin.id,
    },
    {
      title: "Vergi Dairesi İtiraz Süreci",
      description: "Lambda Otomotiv Ltd. 2023 tarhiyatına itiraz dilekçesi.",
      status: "IN_PROGRESS" as const,
      priority: "HIGH" as const,
      assignedToId: murat.id,
      dueDate: days(4),
      createdById: admin.id,
    },
  ];

  for (const t of tasks) {
    await prisma.task.create({ data: t });
  }

  // ── LeaveBalance (2026) ──────────────────────────────
  const employees = [ayse, murat, zeynep];
  for (const emp of employees) {
    await prisma.leaveBalance.upsert({
      where: { userId_year: { userId: emp.id, year: 2026 } },
      update: {},
      create: { userId: emp.id, year: 2026, totalDays: 14, usedDays: 0, remainingDays: 14 },
    });
  }

  console.log("✅ Seed tamamlandı.");
  console.log("   admin@vezin.com       / vezin123  → ADMIN departmanı");
  console.log("   ayse.kaya@vezin.com   / vezin123  → MUHASEBE departmanı");
  console.log("   murat.demir@vezin.com / vezin123  → OUTSOURCE departmanı");
  console.log("   zeynep.celik@vezin.com/ vezin123  → BAGIMSIZ_DENETIM departmanı");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
