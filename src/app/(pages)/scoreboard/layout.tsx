"use client";

import { SessionProvider } from "next-auth/react";

export default function ScoreboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <SessionProvider>{children}</SessionProvider>;
}
