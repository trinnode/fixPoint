import type { Metadata } from "next";
import { Space_Grotesk, Figtree, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/components/query-provider";
import { SiteShell } from "@/components/site-shell";

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const sans = Figtree({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Fixpoint: USD priced escrow on Hedera",
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
      "USD priced escrow, settled in HBAR, proven on HCS. A scaffold hbar template.",
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
        className={`${display.variable} ${sans.variable} ${mono.variable} antialiased bg-background text-foreground`}
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
