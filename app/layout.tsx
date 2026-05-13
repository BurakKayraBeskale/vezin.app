import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Vezin",
  description: "Vezin Vergi & Denetim",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo-login.png",
    apple: "/logo-login.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
