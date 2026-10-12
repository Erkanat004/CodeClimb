import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CODE CLIMB — Python & C++",
  description: "Решай задачи Python и C++ и поднимайся по скале к вершине. Изолированный запуск кода и 15 уровней для каждого языка.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
