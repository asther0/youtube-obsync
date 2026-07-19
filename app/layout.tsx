import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Obsync",
  description: "Captura aprendizajes de video y sincronizalos con Obsidian."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
