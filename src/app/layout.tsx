import type { Metadata } from "next";
import { Geist, Playfair_Display } from "next/font/google";
import { Sidebar } from "@/components/sidebar";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Sharlin", template: "%s · Sharlin" },
  description: "Sharlin bridal shop — customers, appointments, dresses and orders",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${playfair.variable} h-full antialiased`}>
      <body className="min-h-full font-sans md:flex">
        <Sidebar />
        <main className="flex-1 px-4 py-6 md:px-10 md:py-10 max-w-6xl">{children}</main>
      </body>
    </html>
  );
}
