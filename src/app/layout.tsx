import type { Metadata, Viewport } from "next";
import "@fontsource-variable/outfit";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { ServiceWorker } from "@/components/shell/service-worker";

export const metadata: Metadata = {
  title: { default: "MAYFAR Artist Manager", template: "%s · MAYFAR" },
  description: "Sound becomes feeling. The operating system for the Mayfar artist business.",
  applicationName: "MAYFAR",
  appleWebApp: { capable: true, title: "MAYFAR", statusBarStyle: "black" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { themeColor: "#000000", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className="min-h-dvh">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
