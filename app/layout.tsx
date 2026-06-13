import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaRegistration from "@/components/PwaRegistration";

export const metadata: Metadata = {
  title: "บัญชีรายรับรายจ่าย",
  description: "Personal Finance Tracker",
  manifest: "/my-expense-tracker/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "บัญชีรายรับรายจ่าย",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="apple-touch-icon" href="/my-expense-tracker/icon.svg" />
      </head>
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
