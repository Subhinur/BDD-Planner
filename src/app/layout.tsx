import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Desktop Task Planner",
  description: "Single-user local desktop task planner"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
