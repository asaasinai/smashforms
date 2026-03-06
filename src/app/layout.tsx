import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SmashForms",
  description: "Client feedback overlays for Vercel previews."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[rgb(var(--background))] text-[rgb(var(--foreground))] antialiased`}>
        {children}
      </body>
    </html>
  );
}
