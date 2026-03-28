import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI BI Agent — Conversational Business Intelligence",
  description:
    "Ask questions in plain English, get charts, tables, and insights from the Instacart dataset.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
