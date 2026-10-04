import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/components/query-provider";
import { SiteShell } from "@/components/site-shell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
});

export const metadata: Metadata = {
  title: "Fixpoint — USD priced escrow on Hedera",
  description:
    "Price an invoice in dollars. Settle it in HBAR at a live Pyth oracle rate. Mint an HTS receipt and prove every step on an HCS audit topic.",
  keywords: ["Hedera", "HBAR", "Pyth", "escrow", "HTS", "HCS", "Fixpoint"],
  authors: [{ name: "Fixpoint" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Fixpoint",
    description:
      "USD priced escrow, settled in HBAR, proven on HCS. A scaffold-hbar template.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <SiteShell>{children}</SiteShell>
            <Toaster />
            <Sonner />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
