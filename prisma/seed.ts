import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const hash = (pw: string) => bcrypt.hash(pw, 10);

// ─────────────────────────────────────────────────────────
// Gerçek kullanıcılar — upsert ile, mevcut şifreler korunur
// ─────────────────────────────────────────────────────────
const REAL_USERS = [
  { name: "Ayşe Gazel",            email: "aysegazel@vezin.com.tr",         password: "ayse123"      },
  { name: "Ahmet Oruç",            email: "ahmetoruc@vezin.com.tr",          password: "ahmet123"     },
  { name: "Ahmet Yasin Özkul",     email: "ahmetyasinozkul@vezin.com.tr",    password: "ahmet123"     },
  { name: "Ali Kaplan",            email: "alikaplan@vezin.com.tr",           password: "ali123"       },
  { name: "Ali Kayaş",             email: "alikayas@vezin.com.tr",            password: "ali123"       },
  { name: "Ali Mert Yılmaz",       email: "alimertyilmaz@vezin.com.tr",       password: "ali123"       },
  { name: "Alperen Coşkunoğlu",    email: "alperencoskunoglu@vezin.com.tr",   password: "alperen123"   },
  { name: "Asena Ö. Bay",          email: "asenaobay@vezin.com.tr",           password: "asena123"     },
  { name: "Berk Karanfil",         email: "berkkaranfil@vezin.com.tr",        password: "berk123"      },
  { name: "Buğrahan Bozkurt",      email: "bugrahanbozkurt@vezin.com.tr",     password: "bugrahan123"  },
  { name: "Ebubekir Öztürk",       email: "ebubekirozturk@vezin.com.tr",      password: "ebubekir123"  },
  { name: "Ece Coşkun",            email: "ececoskun@vezin.com.tr",           password: "ece123"       },
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
  { name: "İsmail Koş Telsiz",     email: "ismailkostelsiz@vezin.com.tr",     password: "ismail123"    },
  { name: "Janset Türkoğlu",       email: "jansetturkoglu@vezin.com.tr",      password: "janset123"    },
  { name: "Kader Nur Yeşil",       email: "kadernuryesil@vezin.com.tr",       password: "kader123"     },
  { name: "Karya Beşkale",         email: "karyabeskale@vezin.com.tr",        password: "karya123"     },
  { name: "Kerim Doğan",           email: "kerimdogan@vezin.com.tr",          password: "kerim123"     },
  { name: "Merve Uçan",            email: "merveucan@vezin.com.tr",           password: "merve123"     },
  { name: "Meryem Engin",          email: "meryemengin@vezin.com.tr",         password: "meryem123"    },
  { name: "Muhammed Ergurum",      email: "muhammedergurum@vezin.com.tr",     password: "muhammed123"  },
  { name: "Murat Özgür",           email: "muratozgur@vezin.com.tr",          password: "murat123"     },
  { name: "Mustafa Agah Ertürk",   email: "mustafaagaherturk@vezin.com.tr",   password: "mustafa123"   },
  { name: "Nur Satı Yılmaz",       email: "nursatiyilmaz@vezin.com.tr",       password: "nur123"       },
  { name: "Oğuz Çetin",            email: "oguzcetin@vezin.com.tr",           password: "oguz123"      },
  { name: "Ömer Duman",            email: "omerduman@vezin.com.tr",           password: "omer123"      },
  { name: "Ömer Faruk Koş",        email: "omerfarukkos@vezin.com.tr",        password: "omer123"      },
  { name: "Seda Zincirkara",       email: "sedazincirkara@vezin.com.tr",      password: "seda123"      },
  { name: "Selin Kotan",           email: "selinkotan@vezin.com.tr",          password: "selin123"     },
  { name: "Sıtkı Kandazoğlu",      email: "sitkikandazoglu@vezin.com.tr",     password: "sitki123"     },
  { name: "Şeyma Güngör",          email: "seymagungor@vezin.com.tr",         password: "seyma123"     },
  { name: "Taha Bölek",            email: "tahabolek@vezin.com.tr",           password: "taha123"      },
  { name: "Tunahan Kocaoğlu",      email: "tunahankocaoglu@vezin.com.tr",     password: "tunahan123"   },
  { name: "Zeynep Yanık",          email: "zeynepyanik@vezin.com.tr",         password: "zeynep123"    },
  { name: "Ahmet Sait Koş",        email: "ahmetsaitkos@vezin.com.tr",        password: "ahmet123"     },
  { name: "Selman Yalvaç",         email: "selmanyalvac@vezin.com.tr",        password: "selman123"    },
  { name: "Yusuf Can Kabay",       email: "yusufcankabay@vezin.com.tr",       password: "yusuf123"     },
  // Özel hesaplar
  { name: "İKOS B Toplodası",      email: "ikosbtoplodasi@vezin.com.tr",      password: "ikos123"      },
  { name: "K Toplodası",           email: "ktopodasi@vezin.com.tr",           password: "ktopo123"     },
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
          name:              u.name,
          email:             u.email,
          password:          await hash(u.password),
          role:              "EMPLOYEE",
          department:        "OUTSOURCE",
          mustChangePassword: true,
        },
      });
      created++;
    }
  }
  console.log(`✔ Gerçek kullanıcılar: ${created} oluşturuldu, ${updated} güncellendi`);

  // ── Demo kullanıcılar (görevler ve izinler için) ──────────
  const ayse = await prisma.user.upsert({
    where:  { email: "ayse.kaya@vezin.com" },
    update: {},
    create: {
      name:       "Ayşe Kaya",
      email:      "ayse.kaya@vezin.com",
      password:   await hash("vezin123"),
      role:       "EMPLOYEE",
      department: "MUHASEBE",
    },
  });

  const murat = await prisma.user.upsert({
    where:  { email: "murat.demir@vezin.com" },
    update: {},
    create: {
      name:       "Murat Demir",
      email:      "murat.demir@vezin.com",
      password:   await hash("vezin123"),
      role:       "EMPLOYEE",
      department: "OUTSOURCE",
    },
  });

  const zeynep = await prisma.user.upsert({
    where:  { email: "zeynep.celik@vezin.com" },
    update: {},
    create: {
      name:       "Zeynep Çelik",
      email:      "zeynep.celik@vezin.com",
      password:   await hash("vezin123"),
      role:       "EMPLOYEE",
      department: "BAGIMSIZ_DENETIM",
    },
  });

  // ── Görevler (sadece boşsa oluştur) ─────────────────────
  const now = new Date();
  const days = (n: number) => new Date(now.getTime() + n * 86400000);

  const tasks = [
    {
      title:        "2024 Kurumlar Vergisi Beyannamesi Hazırlama",
      description:  "Alfa Holding A.Ş. için Q4 2024 kurumlar vergisi beyannamesi hazırlanacak.",
      status:       "IN_PROGRESS" as const,
      priority:     "HIGH" as const,
      assignedToId: ayse.id,
      dueDate:      days(9),
      createdById:  admin.id,
    },
    {
      title:        "KDV İadesi Dosyası İnceleme",
      description:  "Beta İnşaat Ltd. Mart ayı KDV iadesi için gerekli evraklar incelenecek.",
      status:       "REVIEW" as const,
      priority:     "HIGH" as const,
      assignedToId: murat.id,
      dueDate:      days(2),
      createdById:  admin.id,
    },
    {
      title:        "Bağımsız Denetim Raporu - Q1 2026",
      description:  "Gamma Tekstil A.Ş. Q1 2026 bağımsız denetim raporu hazırlanacak.",
      status:       "IN_PROGRESS" as const,
      priority:     "HIGH" as const,
      assignedToId: zeynep.id,
      dueDate:      days(14),
      createdById:  admin.id,
    },
    {
      title:        "Transfer Fiyatlandırması Dokümantasyonu",
      description:  "Delta Enerji A.Ş. 2025 yılı transfer fiyatlandırması raporu.",
      status:       "TODO" as const,
      priority:     "MEDIUM" as const,
      assignedToId: murat.id,
      dueDate:      days(24),
      createdById:  admin.id,
    },
    {
      title:        "SGK Prim Borç Yapılandırması",
      description:  "Epsilon Lojistik Ltd. SGK borç yapılandırma başvurusu ve takibi.",
      status:       "DONE" as const,
      priority:     "HIGH" as const,
      assignedToId: ayse.id,
      dueDate:      days(-1),
      createdById:  admin.id,
    },
    {
      title:        "Mali Tablo Analizi ve Raporlama",
      description:  "Zeta Gıda A.Ş. 2025 yıl sonu mali tabloları analizi.",
      status:       "DONE" as const,
      priority:     "MEDIUM" as const,
      assignedToId: zeynep.id,
      dueDate:      days(-2),
      createdById:  admin.id,
    },
    {
      title:        "Vergi Riski Değerlendirme Raporu",
      description:  "Eta Teknoloji A.Ş. vergi risk profili değerlendirilecek.",
      status:       "TODO" as const,
      priority:     "MEDIUM" as const,
      assignedToId: murat.id,
      dueDate:      days(19),
      createdById:  admin.id,
    },
    {
      title:        "Stopaj Vergisi Beyannamesi",
      description:  "Alfa Holding A.Ş. Mart ayı muhtasar beyannamesi.",
      status:       "REVIEW" as const,
      priority:     "HIGH" as const,
      assignedToId: ayse.id,
      dueDate:      days(1),
      createdById:  admin.id,
    },
    {
      title:        "İç Denetim Süreci Tasarımı",
      description:  "Iota Perakende A.Ş. iç kontrol ve denetim süreçleri tasarımı.",
      status:       "TODO" as const,
      priority:     "MEDIUM" as const,
      assignedToId: zeynep.id,
      dueDate:      days(29),
      createdById:  admin.id,
    },
    {
      title:        "Vergi Dairesi İtiraz Süreci",
      description:  "Lambda Otomotiv Ltd. 2023 tarhiyatına itiraz dilekçesi.",
      status:       "IN_PROGRESS" as const,
      priority:     "HIGH" as const,
      assignedToId: murat.id,
      dueDate:      days(4),
      createdById:  admin.id,
    },
  ];

  const existingTaskCount = await prisma.task.count();
  if (existingTaskCount === 0) {
    for (const t of tasks) {
      await prisma.task.create({ data: t });
    }
    console.log(`✔ ${tasks.length} demo görev oluşturuldu`);
  } else {
    console.log(`   ⏭  Görevler atlandı (${existingTaskCount} kayıt mevcut)`);
  }

  // ── LeaveBalance (2026) ──────────────────────────────────
  for (const emp of [ayse, murat, zeynep]) {
    await prisma.leaveBalance.upsert({
      where:  { userId_year: { userId: emp.id, year: 2026 } },
      update: {},
      create: { userId: emp.id, year: 2026, totalDays: 14, usedDays: 0, remainingDays: 14 },
    });
  }

  console.log("\n✅ Seed tamamlandı.");
  console.log("   admin@vezin.com  / vezin123  → ADMIN");
  console.log(`   ${REAL_USERS.length} gerçek kullanıcı → EMPLOYEE / OUTSOURCE / mustChangePassword: true`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
