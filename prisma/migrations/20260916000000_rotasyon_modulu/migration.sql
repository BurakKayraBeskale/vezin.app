-- Rotasyon Takip modülü
-- User.canAccessRotasyon: erişim yalnızca bu bayrak veya ADMIN rolü ile verilir
-- (bkz. lib/access.ts canAccessRotasyon) — kıdem/departman/e-postadan türetilmez.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "canAccessRotasyon" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RotasyonIsletme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unvan" TEXT NOT NULL,
    "vkn" TEXT NOT NULL,
    "oncekiDenetciIlkDonem" INTEGER,
    "oncekiDenetciSonDonem" INTEGER,
    "not" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "RotasyonSozlesme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "isletmeId" TEXT NOT NULL,
    "sozlesmeNo" TEXT NOT NULL,
    "donem" INTEGER NOT NULL,
    "tur" TEXT NOT NULL,
    "not" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RotasyonSozlesme_isletmeId_fkey" FOREIGN KEY ("isletmeId") REFERENCES "RotasyonIsletme" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RotasyonKadro" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sozlesmeId" TEXT NOT NULL,
    "adSoyad" TEXT NOT NULL,
    "unvan" TEXT NOT NULL,
    "tip" TEXT NOT NULL,
    "fiilenGorevAldi" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "RotasyonKadro_sozlesmeId_fkey" FOREIGN KEY ("sozlesmeId") REFERENCES "RotasyonSozlesme" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RotasyonAyar" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "azamiSure" INTEGER NOT NULL DEFAULT 7,
    "zorunluAra" INTEGER NOT NULL DEFAULT 3,
    "uyariEsigi" INTEGER NOT NULL DEFAULT 3
);

-- CreateIndex
CREATE UNIQUE INDEX "RotasyonIsletme_vkn_key" ON "RotasyonIsletme"("vkn");

-- CreateIndex
CREATE UNIQUE INDEX "RotasyonSozlesme_isletmeId_donem_key" ON "RotasyonSozlesme"("isletmeId", "donem");
