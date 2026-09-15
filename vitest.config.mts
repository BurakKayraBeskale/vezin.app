import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    // Testler sıralı çalışsın — dev.db üzerinde paralel yazma çakışmaması için.
    // Vitest 4'te eski `singleThread` anahtarı tek bir dosya içindeki testleri
    // seri çalıştırır ama DOSYALAR ARASI paralelliği engellemez; bu da farklı
    // test dosyalarının aynı anda dev.db üzerinde beforeAll/afterAll çalıştırıp
    // birbirinin verisini (örn. henüz silinmemiş bir kullanıcıya referans veren
    // görev) görmesine yol açabiliyordu (ara sıra "createdBy ... got null" hatası).
    // fileParallelism:false TÜM dosyaları da seri çalıştırır.
    fileParallelism: false,
    singleThread: true,
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
