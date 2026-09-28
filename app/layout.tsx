import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CODE CLIMB — Python Ascent",
  description: "Решай задачи Python и поднимайся по скале к вершине. 15 уровней, редактор кода и аватары соперников.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
