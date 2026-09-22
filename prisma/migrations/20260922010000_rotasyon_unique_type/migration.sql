-- Rotasyon sözleşmeleri: benzersizlik kuralını işletme+dönem'den işletme+dönem+tür'e genişletir.
--
-- Önceki kural (işletme + dönem) aynı yılda FARKLI türde ikinci bir sözleşmeyi
-- (ör. bağımsız denetim + özel amaçlı denetim) engelliyordu. Artık yalnızca
-- aynı işletme + aynı dönem + AYNI tür mükerrerliği engellenir.
--
-- Mevcut kayıtlara dokunulmaz — yalnızca indeks değişir, veri silinmez/değişmez.

-- DropIndex
DROP INDEX "RotasyonSozlesme_isletmeId_donem_key";

-- CreateIndex
CREATE UNIQUE INDEX "RotasyonSozlesme_isletmeId_donem_tur_key" ON "RotasyonSozlesme"("isletmeId", "donem", "tur");
