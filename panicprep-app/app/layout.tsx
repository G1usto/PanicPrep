import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "PanicPrep",
  title: {
    default: "PanicPrep",
    template: "%s | PanicPrep",
  },
  description: "A mobile-first student panic helper.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PanicPrep",
  },
  icons: {
    icon: "/panicprep-icon.svg",
    apple: "/panicprep-icon.svg",
  },
  openGraph: {
    title: "PanicPrep",
    description: "Upload a homework screenshot, pick a help mode, and copy a ready prompt.",
    siteName: "PanicPrep",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
