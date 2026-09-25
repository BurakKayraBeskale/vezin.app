import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const hash = (pw: string) => bcrypt.hash(pw, 10);

// ─────────────────────────────────────────────────────────
// Gerçek kullanıcılar — upsert ile, mevcut şifreler korunur
// ─────────────────────────────────────────────────────────
const REAL_USERS: { name: string; email: string; password: string; department?: string }[] = [
  { name: "Ahmet Oruç",            email: "ahmetoruc@vezin.com.tr",          password: "ahmet123"     },
  { name: "Ahmet Yasin Özkul",     email: "ahmetyasinozkul@vezin.com.tr",    password: "ahmet123"     },
  { name: "Ali Mert Yılmaz",       email: "alimertyilmaz@vezin.com.tr",       password: "ali123"       },
  { name: "Alperen Coşkunoğlu",    email: "alperencoskunoglu@vezin.com.tr",   password: "alperen123"   },
  { name: "Asena Ö. Bay",          email: "asenaobay@vezin.com.tr",           password: "asena123"     },
  { name: "Berk Karanfil",         email: "berkkaranfil@vezin.com.tr",        password: "berk123"      },
  { name: "Buğrahan Bozkurt",      email: "bugrahanbozkurt@vezin.com.tr",     password: "bugrahan123"  },
  { name: "Ebubekir Öztürk",       email: "ebubekirozturk@vezin.com.tr",      password: "ebubekir123"  },
  { name: "Efecan Güvenir",        email: "efecanguvenir@vezin.com.tr",       password: "efecan123"    },
  { name: "Elif Demirci",          email: "elifdemirci@vezin.com.tr",         password: "elif123"      },
  { name: "Emre Güvenç",           email: "emreguvenc@vezin.com.tr",          password: "emre123"      },
  { name: "Esra Fırat",            email: "esrafirat@vezin.com.tr",           password: "esra123"      },
  { name: "Fatih Gözyuman",        email: "fatihgozyuman@vezin.com.tr",       password: "fatih123"     },
  { name: "Fatmanur Arslan",       email: "fatmanurarslan@vezin.com.tr",      password: "fatmanur123"  },
  { name: "Filiz Ö. Doğan",        email: "filizodogan@vezin.com.tr",         password: "filiz123"     },
  { name: "Gülşen Gül Yılmaz",     email: "gulsengulyilmaz@vezin.com.tr",     password: "gulsen123"    },
  { name: "Hasan Karaağaç",        email: "hasankaraagac@vezin.com.tr",       password: "hasan123"     },
  { name: "İsmail Koş",            email: "ismailkos@vezin.com.tr",           password: "ismail123"    },
  { name: "Janset Türkoğlu",       email: "jansetturkoglu@vezin.com.tr",      password: "janset123"    },
  { name: "Kader Nur Yeşil",       email: "kadernuryesil@vezin.com.tr",       password: "kader123"     },
  { name: "Kerim Doğan",           email: "kerimdogan@vezin.com.tr",          password: "kerim123"     },
  { name: "Merve Uçan",            email: "merveucan@vezin.com.tr",           password: "merve123"     },
  { name: "Meryem Engin",          email: "meryemengin@vezin.com.tr",         password: "meryem123"    },
  { name: "Muhammed Ergurum",      email: "muhammedergurum@vezin.com.tr",     password: "muhammed123"  },
  { name: "Murat Özgür",           email: "muratozgur@vezin.com.tr",          password: "murat123"     },
  { name: "Mustafa Agah Ertürk",   email: "mustafaagaherturk@vezin.com.tr",   password: "mustafa123"   },
  { name: "Nur Satı Yılmaz",       email: "nursatiyilmaz@vezin.com.tr",       password: "nur123"       },
  { name: "Oğuz Çetin",            email: "oguzcetin@vezin.com.tr",           password: "oguz123"      },
  { name: "Ömer Faruk Koş",        email: "omerfarukkos@vezin.com.tr",        password: "omer123"      },
  { name: "Seda Zincirkara",       email: "sedazincirkara@vezin.com.tr",      password: "seda123"      },
  { name: "Selin Kotan",           email: "selinkotan@vezin.com.tr",          password: "selin123"     },
  { name: "Sıtkı Kandazoğlu",      email: "sitkikandazoglu@vezin.com.tr",     password: "sitki123"     },
  { name: "Şeyma Güngör",          email: "seymagungor@vezin.com.tr",         password: "seyma123"     },
  { name: "Taha Bölek",            email: "tahabolek@vezin.com.tr",           password: "taha123"      },
  { name: "Tunahan Kocaoğlu",      email: "tunahankocaoglu@vezin.com.tr",     password: "tunahan123"   },
  { name: "Zeynep Yanık",          email: "zeynepyanik@vezin.com.tr",         password: "zeynep123"    },
  { name: "Özlem İnce",            email: "ozlemince@vezin.com.tr",           password: "ozlem123",     department: "YEMINLI_MALI_MUSAVIR" },
];

async function main() {
  // ── Admin ────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where:  { email: "admin@vezin.com" },
    update: { mustChangePassword: false },
    create: {
      name:              "Admin Vezin",
      email:             "admin@vezin.com",
      password:          await hash("vezin123"),
      role:              "ADMIN",
      department:        "ADMIN",
      mustChangePassword: false,
      canManageCompanies: false,
    },
  });
  console.log("✔ admin@vezin.com");

  // ── Gerçek kullanıcılar ──────────────────────────────────
  // update: sadece ismi güncelle; şifre ve mustChangePassword korunur
  let created = 0;
  let updated = 0;
  for (const u of REAL_USERS) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) {
      await prisma.user.update({
        where: { email: u.email },
        data:  { name: u.name },
      });
      updated++;
    } else {
      await prisma.user.create({
        data: {
          name:               u.name,
          email:              u.email,
          password:           await hash(u.password),
          role:               "EMPLOYEE",
          department:         u.department ?? "OUTSOURCE",
          mustChangePassword: true,
          canManageCompanies: false,
        },
      });
      created++;
    }
  }
  console.log(`✔ Gerçek kullanıcılar: ${created} oluşturuldu, ${updated} güncellendi`);

  // NOT: eski "demo kullanıcılar" (ayse.kaya@vezin.com, murat.demir@vezin.com,
  // zeynep.celik@vezin.com) ve onlara bağlı demo görev/izin bakiyesi seed'i
  // kaldırıldı — bu hesaplar veritabanından silindi, seed onları geri
  // getirmemeli (İZİN YÖNETİMİ MODÜLÜ turu). Aşağıdaki görev bloğu zaten
  // yalnızca veritabanı tamamen boşsa (existingTaskCount === 0) çalışıyordu;
  // gerçek kullanım başladığından bu koşul artık hiç sağlanmıyor.
  // Admin hesabı: canViewAllTasks=true
  await prisma.user.updateMany({
    where: { email: "admin@vezin.com" },
    data: { canViewAllTasks: true, canViewAllProjects: true },
  });

  // ── Kıdem, Görünürlük ve Departman Gözetimi — E-posta tabanlı ──────────
  //
  // Her kayıt: { email, title, seniorityLevel, canViewAllTasks?, canViewAllProjects?, overseesDepartment? }
  //
  // canViewAllProjects ASLA unvandan türetilmez; yalnızca burada açıkça belirtilen
  // kişiler bu yetkiyi alır (Ebubekir Öztürk SM2 olsa da canViewAllProjects=false).
  //
  // 14-seviyeli unvan sistemi (lib/hierarchy.ts → TITLE_TO_LEVEL):
  //   Stajyer                        = 1
  //   Assistant                      = 2
  //   Experienced Assistant 1        = 3
  //   Experienced Assistant 2        = 4
  //   Senior 1                       = 5
  //   Senior 2                       = 6
  //   Assistant Manager              = 7
  //   Manager 1                      = 8
  //   Manager 2                      = 9
  //   Manager 3                      = 10
  //   Senior Manager 1               = 11
  //   Senior Manager 2               = 12
  //   Senior Manager 3               = 13
  //   Partner                        = 14
  const EMAIL_MAP: {
    email: string;
    title: string;
    seniorityLevel: number;
    canViewAllTasks?: boolean;
    canViewAllProjects?: boolean;
    overseesDepartment?: string | null;
    canBeAssignedTasks?: boolean;
  }[] = [
    // Ortaklar — tüm birimleri görür, herkese görev atayabilir; kendilerine görev ATANAMAZ
    { email: "ismailkos@vezin.com.tr",      title: "Partner",           seniorityLevel: 14, canViewAllTasks: true,  canViewAllProjects: true,  overseesDepartment: null,               canBeAssignedTasks: false },
    { email: "muratozgur@vezin.com.tr",     title: "Partner",           seniorityLevel: 14, canViewAllTasks: true,  canViewAllProjects: false, overseesDepartment: "YMM",              canBeAssignedTasks: false },
    // Departman gözetmenleri — yalnızca kendi birimi (canViewAllProjects=false); kendilerine görev ATANAMAZ
    { email: "ahmetoruc@vezin.com.tr",      title: "Partner",           seniorityLevel: 14, canViewAllProjects: false, overseesDepartment: "BAGIMSIZ_DENETIM", canBeAssignedTasks: false },
    { email: "ebubekirozturk@vezin.com.tr", title: "Senior Manager 2",  seniorityLevel: 12, canViewAllProjects: false, overseesDepartment: "YMM",              canBeAssignedTasks: false },
    // TODO: İcmal listesindeki diğer kişileri buraya ekleyin
    // Örnek: { email: "...", title: "Senior 1", seniorityLevel: 5, canViewAllProjects: false, overseesDepartment: null },
  ];

  for (const entry of EMAIL_MAP) {
    const existing = await prisma.user.findUnique({ where: { email: entry.email } });
    if (!existing) {
      console.warn(`⚠ Kıdem eşleşmedi: ${entry.email}`);
      continue;
    }
    const { email: _e, ...data } = entry;
    await prisma.user.update({ where: { email: entry.email }, data });
  }

  console.log("✔ Kıdem seviyeleri ve görünürlük rolleri güncellendi");

  // ── showInPerformance=false — bu hesaplar performans listesinde görünmez ──
  const HIDE_FROM_PERFORMANCE = [
    "admin@vezin.com",
    "bagimsiz@vezin.com",
    "berkkaranfil@vezin.com.tr",
    "gulsengulyilmaz@vezin.com.tr",
    "muhasebe@vezin.com",
    "ymm@vezin.com",
  ];

  for (const em of HIDE_FROM_PERFORMANCE) {
    const u = await prisma.user.findUnique({ where: { email: em } });
    if (!u) {
      console.warn(`⚠ showInPerformance=false: kullanıcı bulunamadı: ${em}`);
      continue;
    }
    await prisma.user.update({ where: { email: em }, data: { showInPerformance: false } });
  }
  console.log("✔ showInPerformance=false uygulandı");

  // ── İşe giriş tarihi + devir kullanımı — İZİN YÖNETİMİ MODÜLÜ ────────────
  // E-posta ile eşleştirilir, isimle DEĞİL. Aynı eşleme migration'larda
  // (20260924000000_leave_module, 20260925000000_leave_carryover) UPDATE ile de
  // yazıldı — burada AYRICA tutulmasının sebebi: seed sıfırdan çalıştığında
  // (migration uygulandıktan SONRA oluşturulan kullanıcılar, ör. Özlem İnce,
  // migration anında henüz yoktu) değerlerin kaybolmamasıdır. Eşleşmeyen
  // e-posta olursa konsola uyarı basılır, seed durmaz.
  //   hireDate      — null ise mevcut değere DOKUNULMAZ (kaynak dosyada yok).
  //   carryUsedDays — uygulama öncesi kullanılan yıllık izin (firma Excel'i);
  //                   listede olmayanlar 0 kalır.
  // ahmetoruc / gulsengulyilmaz yeni kaynak dosyada yok — önceki tarihleri korunur.
  const LEAVE_DATA_MAP: Record<string, { hireDate: string | null; carryUsedDays: number }> = {
    "emreguvenc@vezin.com.tr":        { hireDate: "2016-11-14", carryUsedDays: 142 },
    "ebubekirozturk@vezin.com.tr":    { hireDate: "2017-01-02", carryUsedDays: 143 },
    "muratozgur@vezin.com.tr":        { hireDate: null,         carryUsedDays: 31.5 },
    "sedazincirkara@vezin.com.tr":    { hireDate: "2016-11-09", carryUsedDays: 104 },
    "ahmetyasinozkul@vezin.com.tr":   { hireDate: "2019-11-18", carryUsedDays: 81.5 },
    "alperencoskunoglu@vezin.com.tr": { hireDate: "2020-10-21", carryUsedDays: 64.5 },
    "mustafaagaherturk@vezin.com.tr": { hireDate: "2021-06-23", carryUsedDays: 59.5 },
    "nursatiyilmaz@vezin.com.tr":     { hireDate: "2022-03-28", carryUsedDays: 44.5 },
    "hasankaraagac@vezin.com.tr":     { hireDate: "2022-03-28", carryUsedDays: 49 },
    "bugrahanbozkurt@vezin.com.tr":   { hireDate: "2022-09-19", carryUsedDays: 52 },
    "fatihgozyuman@vezin.com.tr":     { hireDate: "2023-05-26", carryUsedDays: 32.5 },
    "seymagungor@vezin.com.tr":       { hireDate: "2023-05-26", carryUsedDays: 44.5 },
    "filizodogan@vezin.com.tr":       { hireDate: "2023-05-26", carryUsedDays: 46 },
    "meryemengin@vezin.com.tr":       { hireDate: "2023-12-06", carryUsedDays: 33.5 },
    "tunahankocaoglu@vezin.com.tr":   { hireDate: "2024-04-29", carryUsedDays: 41 },
    "oguzcetin@vezin.com.tr":         { hireDate: "2023-12-06", carryUsedDays: 16.5 },
    "tahabolek@vezin.com.tr":         { hireDate: "2023-12-06", carryUsedDays: 22 },
    "esrafirat@vezin.com.tr":         { hireDate: "2023-12-06", carryUsedDays: 30 },
    "selinkotan@vezin.com.tr":        { hireDate: "2024-09-09", carryUsedDays: 16.5 },
    "kerimdogan@vezin.com.tr":        { hireDate: "2024-08-26", carryUsedDays: 23 },
    "asenaobay@vezin.com.tr":         { hireDate: "2024-12-05", carryUsedDays: 36.5 },
    "efecanguvenir@vezin.com.tr":     { hireDate: "2024-11-25", carryUsedDays: 31 },
    "sitkikandazoglu@vezin.com.tr":   { hireDate: "2025-01-08", carryUsedDays: 23.5 },
    "alimertyilmaz@vezin.com.tr":     { hireDate: "2024-09-02", carryUsedDays: 21 },
    "kadernuryesil@vezin.com.tr":     { hireDate: "2025-04-17", carryUsedDays: 15.5 },
    "berkkaranfil@vezin.com.tr":      { hireDate: "2025-06-17", carryUsedDays: 17.5 },
    "jansetturkoglu@vezin.com.tr":    { hireDate: "2025-07-17", carryUsedDays: 26 },
    "merveucan@vezin.com.tr":         { hireDate: "2025-07-17", carryUsedDays: 25.5 },
    "elifdemirci@vezin.com.tr":       { hireDate: "2023-12-06", carryUsedDays: 28 },
    "muhammedergurum@vezin.com.tr":   { hireDate: "2025-12-08", carryUsedDays: 12 },
    "fatmanurarslan@vezin.com.tr":    { hireDate: "2026-02-02", carryUsedDays: 2 },
    "zeynepyanik@vezin.com.tr":       { hireDate: "2026-02-02", carryUsedDays: 10 },
    "ozlemince@vezin.com.tr":         { hireDate: "2026-06-03", carryUsedDays: 6 },
    "ahmetoruc@vezin.com.tr":         { hireDate: "2024-04-03", carryUsedDays: 0 },
    "gulsengulyilmaz@vezin.com.tr":   { hireDate: "2026-01-10", carryUsedDays: 0 },
  };

  let leaveDataSet = 0;
  for (const [em, { hireDate, carryUsedDays }] of Object.entries(LEAVE_DATA_MAP)) {
    const u = await prisma.user.findUnique({ where: { email: em } });
    if (!u) {
      console.warn(`⚠ hireDate/carryUsedDays eşleşmedi: ${em}`);
      continue;
    }
    await prisma.user.update({
      where: { email: em },
      data: { carryUsedDays, ...(hireDate ? { hireDate: new Date(hireDate) } : {}) },
    });
    leaveDataSet++;
  }
  console.log(`✔ İşe giriş tarihi / devir: ${leaveDataSet}/${Object.keys(LEAVE_DATA_MAP).length} kullanıcıya yazıldı`);

  // ── showInLeaveOverview=false — /izin-durumu personel listesinden gizlenir ──
  // showInPerformance'tan bağımsız, ayrı bayrak. İsmail Koş (patron) tüm
  // personeli görmeye ve izin onaylamaya devam eder; yalnızca LİSTEDE görünmez.
  const HIDE_FROM_LEAVE_OVERVIEW = ["ismailkos@vezin.com.tr"];

  for (const em of HIDE_FROM_LEAVE_OVERVIEW) {
    const u = await prisma.user.findUnique({ where: { email: em } });
    if (!u) {
      console.warn(`⚠ showInLeaveOverview=false: kullanıcı bulunamadı: ${em}`);
      continue;
    }
    await prisma.user.update({ where: { email: em }, data: { showInLeaveOverview: false } });
  }
  console.log("✔ showInLeaveOverview=false uygulandı");

  // ── canAccessRotasyon=true — Rotasyon Takip modülüne erişim ──
  // Rol kısayolu yok (bkz. lib/access.ts canAccessRotasyon) — yalnızca
  // burada listelenen e-postalar erişir.
  const CAN_ACCESS_ROTASYON = [
    "admin@vezin.com",
    "ahmetoruc@vezin.com.tr",
    "omerfarukkos@vezin.com.tr",
    "ismailkos@vezin.com.tr",
  ];

  for (const em of CAN_ACCESS_ROTASYON) {
    const u = await prisma.user.findUnique({ where: { email: em } });
    if (!u) {
      console.warn(`⚠ canAccessRotasyon=true: kullanıcı bulunamadı: ${em}`);
      continue;
    }
    await prisma.user.update({ where: { email: em }, data: { canAccessRotasyon: true } });
  }
  console.log("✔ canAccessRotasyon=true uygulandı");

  console.log("\n✅ Seed tamamlandı.");
  console.log("   admin@vezin.com  / vezin123  → ADMIN");
  console.log(`   ${REAL_USERS.length} gerçek kullanıcı → EMPLOYEE / OUTSOURCE / mustChangePassword: true`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
