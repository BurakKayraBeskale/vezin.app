-- CreateTable (drop old if exists, create new KdvIadeKayit)
DROP TABLE IF EXISTS "KdvIadeKayit";

CREATE TABLE "KdvIadeKayit" (
    "id"           TEXT NOT NULL PRIMARY KEY,
    "tur"          TEXT NOT NULL,
    "faturaSayisi" INTEGER NOT NULL,
    "toplamKdv"    REAL NOT NULL,
    "haricTutulan" INTEGER NOT NULL DEFAULT 0,
    "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
