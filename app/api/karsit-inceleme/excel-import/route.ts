import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export const dynamic = "force-dynamic";

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { role, department } = token as any;
  if (role !== "ADMIN" && department !== "YEMINLI_MALI_MUSAVIR") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 }); }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 400 });

  const lc = file.name.toLowerCase();
  if (!lc.endsWith(".xlsx") && !lc.endsWith(".xls"))
    return NextResponse.json({ error: "Yalnızca .xlsx / .xls desteklenir" }, { status: 400 });

  if (file.size > MAX_SIZE)
    return NextResponse.json({ error: "Dosya 20MB sınırını aşıyor" }, { status: 400 });

  try {
    const XLSX      = require("xlsx");
    const buf       = Buffer.from(await file.arrayBuffer());
    const wb        = XLSX.read(buf, { type: "buffer", cellDates: true });
    const sheetName = wb.SheetNames[0];
    const ws        = wb.Sheets[sheetName];

    const raw: any[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: "",
      raw: false,
      dateNF: "DD.MM.YYYY",
    });

    if (raw.length === 0)
      return NextResponse.json({ error: "Dosya boş" }, { status: 400 });

    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(5, raw.length); i++) {
      if (raw[i].some((c: any) => String(c).trim().length > 0)) {
        headerRowIdx = i;
        break;
      }
    }

    const headers: string[] = raw[headerRowIdx].map((c: any) => String(c ?? "").trim());
    const rows: string[][]  = raw
      .slice(headerRowIdx + 1)
      .filter((r: any[]) => r.some((c: any) => String(c ?? "").trim().length > 0))
      .map((r: any[]) => r.map((c: any) => String(c ?? "").trim()));

    return NextResponse.json({
      filename: file.name,
      headers,
      rows,
      totalRows: rows.length,
    });
  } catch (err: any) {
    console.error("[karsit-inceleme/excel-import]", err);
    return NextResponse.json({ error: "Excel okunamadı: " + (err?.message ?? "") }, { status: 500 });
  }
}
