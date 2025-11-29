import "rbrgs/styles/globals.css";

import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";
import { Jersey_25, Anton, Archivo } from "next/font/google";

import { TRPCReactProvider } from "rbrgs/trpc/react";
import { Toaster } from "rbrgs/app/_components/shadcn/ui/sonner";
import Navbar from "./_components/navbar";
import { NextSSRPlugin } from "@uploadthing/react/next-ssr-plugin";
import { extractRouterConfig } from "uploadthing/server";
import { ourFileRouter } from "rbrgs/server/uploadthing";

export const metadata: Metadata = {
  title: "Robochamp 2025",
  description:
    "Robochamp 2025 by RoBorregos, ITESM's biggest robotics competition",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const jersey_25 = Jersey_25({
  subsets: ["latin"],
  display: "swap",
  weight: ["400"],
  variable: "--font-jersey-25",
});

const anton = Anton({
  subsets: ["latin"],
  display: "swap",
  weight: ["400"],
  variable: "--font-anton",
});

const archivo = Archivo({
  subsets: ["latin"],
  display: "swap",
  weight: ["400"],
  variable: "--font-archivo",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${jersey_25.variable} ${anton.variable} ${archivo.variable}`}
    >
      <body className="bg-black">
        <NextSSRPlugin routerConfig={extractRouterConfig(ourFileRouter)} />
        <Navbar />
        <Toaster />
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
