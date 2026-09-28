import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CODE CLIMB — Reach the summit",
  description: "A competitive programming ascent through Python and C++ challenges.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
