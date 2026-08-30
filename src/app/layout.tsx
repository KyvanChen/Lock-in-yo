import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DataProvider } from "@/lib/store";
import { TimerProvider } from "@/lib/timer";
import { AmbientProvider } from "@/lib/ambient";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Lock In",
  description:
    "A planner for coursework, projects and studying, with a focus timer built in.",
  appleWebApp: { capable: true, title: "Lock In", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <DataProvider>
          <AmbientProvider>
            <TimerProvider>
              <AppShell>{children}</AppShell>
            </TimerProvider>
          </AmbientProvider>
        </DataProvider>
      </body>
    </html>
  );
}
