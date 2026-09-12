import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "DevBoard",
  description: "A focused workspace for your projects and tasks.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
