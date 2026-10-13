import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CODE CLIMB — Python & C++",
  description: "Решай задачи Python и C++ и поднимайся к вершине. Solve Python and C++ challenges on your way to the summit — 15 levels per route.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
