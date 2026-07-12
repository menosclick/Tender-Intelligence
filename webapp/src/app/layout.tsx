import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tender Intelligence — CBA Benelux",
  description: "Internal tender intelligence dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
