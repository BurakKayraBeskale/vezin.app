"use client";

import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError("E-posta veya şifre hatalı.");
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundColor: "#F4F5F7",
        backgroundImage:
          "radial-gradient(circle, #C9CDD6 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <a href="/">
            <img
              src="/logo-login.png?v=2"
              alt="Vezin"
              style={{ width: "300px", height: "auto" }}
            />
          </a>
          {/* Ayraç */}
          <div
            className="mt-6 h-px w-16"
            style={{
              background:
                "linear-gradient(to right, transparent, #F57C28, transparent)",
              opacity: 0.5,
            }}
          />
        </div>

        {/* Kart */}
        <div
          className="bg-white rounded-2xl border border-gray-100 p-8"
          style={{
            boxShadow:
              "0 8px 40px -8px rgba(0,0,0,0.13), 0 2px 8px -2px rgba(0,0,0,0.06)",
          }}
        >
          <h2 className="text-xl font-extrabold text-gray-900 mb-6">
            Giriş Yap
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                E-posta
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@vezin.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/40 focus:border-[#F57C28] transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Şifre
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F57C28]/40 focus:border-[#F57C28] transition-colors"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#F57C28] hover:bg-[#D96A1A] disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-colors shadow-md shadow-[#F57C28]/30 mt-2"
            >
              {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Vezin Vergi &amp; Denetim A.Ş. · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
