import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sal — Your Back-Office Teammate for Plumbing Businesses",
  description:
    "Sal answers the phone, books the jobs, dispatches techs, and sends invoices. The back-office teammate that never calls in sick.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900 antialiased">{children}</body>
    </html>
  );
}
