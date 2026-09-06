import type { Metadata, Viewport } from "next";
import { Assistant, Rubik } from "next/font/google";
import { SerwistProvider } from "@serwist/turbopack/react";
import { DirectionProvider } from "@/components/ui/direction";
import { Toaster } from "@/components/ui/sonner";
import { MotionProvider } from "@/components/shared/motion-provider";
import { OfflineBanner } from "@/components/shared/offline-banner";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { OfflineQueueProvider } from "@/lib/offline/provider";
import "./globals.css";

const assistant = Assistant({
  variable: "--font-assistant",
  subsets: ["hebrew", "latin"],
  display: "swap",
});

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["hebrew", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "הסל שלנו",
  description: "רשימת הקניות המשותפת של המשפחה",
  applicationName: "הסל שלנו",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "הסל שלנו",
  },
  formatDetection: { telephone: false },
  icons: { apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAF9" },
    { media: "(prefers-color-scheme: dark)", color: "#09090B" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="he"
      dir="rtl"
      suppressHydrationWarning
      className={`${assistant.variable} ${rubik.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* `reloadOnOnline` stays off: the offline queue flushes and refreshes itself. */}
        <SerwistProvider swUrl="/serwist/sw.js" reloadOnOnline={false}>
          <ThemeProvider>
            <DirectionProvider dir="rtl">
              <MotionProvider>
                <OfflineQueueProvider>
                  <OfflineBanner />
                  {children}
                  <Toaster position="bottom-center" dir="rtl" closeButton />
                </OfflineQueueProvider>
              </MotionProvider>
            </DirectionProvider>
          </ThemeProvider>
        </SerwistProvider>
      </body>
    </html>
  );
}
