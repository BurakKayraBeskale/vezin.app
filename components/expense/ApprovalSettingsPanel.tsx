"use client";

/**
 * Onay Ayarları (yalnız ADMIN) — her departman için birden fazla onaycı.
 * Departmanlar User.department'taki mevcut değerlerden dinamik gelir; aday
 * listesi yalnız o departmanın aktif kullanıcılarıdır (sunucu da doğrular).
 */

import { useEffect, useState } from "react";
import { expenseDepartmentLabel } from "@/lib/expense/constants";
import { Card, ErrorBox, btnPrimary, readError } from "./ui";

interface DeptSetting {
  department: string;
  users: { id: string; name: string; title: string }[];
  approverIds: string[];
  invalidApprovers: { id: string; name: string; reason: string }[];
}

function DepartmentCard({ setting, onSaved }: { setting: DeptSetting; onSaved: (all: DeptSetting[]) => void }) {
  const [selected, setSelected] = useState<string[]>(setting.approverIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => setSelected(setting.approverIds), [setting.approverIds]);

  const dirty =
    selected.length !== setting.approverIds.length ||
    selected.some((id) => !setting.approverIds.includes(id)) ||
    setting.invalidApprovers.length > 0;

  function toggle(id: string) {
    setSaved(false);
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/expenses/approval-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department: setting.department, approverIds: selected }),
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      onSaved((await res.json()).departments);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title={
        <span>
          {expenseDepartmentLabel(setting.department)}
          <span className="ml-2 text-[11px] font-medium text-gray-400">{setting.department}</span>
        </span>
      }
      right={
        <span className={`text-xs font-semibold ${setting.approverIds.length ? "text-emerald-600" : "text-red-600"}`}>
          {setting.approverIds.length ? `${setting.approverIds.length} onaycı` : "Onay akışı tanımsız"}
        </span>
      }
    >
      <div className="p-5 space-y-3">
        {setting.invalidApprovers.length > 0 && (
          <div className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
            Geçersiz onaycı kaydı (yeni gönderimlerde dikkate alınmaz, kaydedince temizlenir):{" "}
            {setting.invalidApprovers.map((a) => `${a.name} (${a.reason})`).join(", ")}
          </div>
        )}
        {setting.users.length === 0 ? (
          <p className="text-sm text-gray-400">Bu departmanda aktif kullanıcı yok.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-64 overflow-y-auto">
            {setting.users.map((u) => (
              <label
                key={u.id}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer text-sm"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(u.id)}
                  onChange={() => toggle(u.id)}
                  className="w-4 h-4 accent-[#F57C28]"
                />
                <span className="text-gray-700 truncate">{u.name}</span>
                {u.title && <span className="text-[11px] text-gray-400 truncate">{u.title}</span>}
              </label>
            ))}
          </div>
        )}
        {error && <ErrorBox>{error}</ErrorBox>}
        <div className="flex items-center justify-end gap-3">
          {saved && !dirty && <span className="text-xs text-emerald-600 font-medium">Kaydedildi</span>}
          <button type="button" onClick={save} disabled={!dirty || saving} className={btnPrimary}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>
    </Card>
  );
}

export default function ApprovalSettingsPanel() {
  const [settings, setSettings] = useState<DeptSetting[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/expenses/approval-settings")
      .then(async (r) => (r.ok ? r.json() : Promise.reject(await readError(r))))
      .then((d) => setSettings(d.departments))
      .catch((e) => setError(typeof e === "string" ? e : "Ayarlar yüklenemedi"));
  }, []);

  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!settings) return <div className="text-sm text-gray-400">Yükleniyor…</div>;

  return (
    <div className="space-y-4">
      <div className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 leading-relaxed">
        Onaycılar yalnızca ilgili departmanın aktif kullanıcıları arasından seçilebilir. Bir departmanın tüm onaycılarının
        onayı gerekir (paralel, sırasız). Tanımlı onaycılardan biri kendi formunu gönderirse departman onayı atlanır.
        Değişiklikler <strong>yalnızca yeni gönderimlere</strong> uygulanır; onay sürecindeki formlar gönderim anındaki
        onaycılarla devam eder.
      </div>
      {settings.map((s) => (
        <DepartmentCard key={s.department} setting={s} onSaved={setSettings} />
      ))}
    </div>
  );
}
