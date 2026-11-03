import type { Metadata, Viewport } from "next";
import { Fraunces, Geist_Mono, Public_Sans } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "./pwa-register";

// Public Sans: a civic, highly legible sans for interface text and numbers.
// Fraunces: a warm display serif for the few lines that should feel human.
const publicSans = Public_Sans({
  variable: "--font-text",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz", "SOFT"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HydroSentinel — Give communities more time",
  description: "Explainable flood forecasting for the people closest to the risk.",
  applicationName: "HydroSentinel",
  appleWebApp: { capable: true, title: "HydroSentinel", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7f3" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1a1d" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${publicSans.variable} ${fraunces.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
