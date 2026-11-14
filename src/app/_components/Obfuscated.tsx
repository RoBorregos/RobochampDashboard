"use client";
import { useEffect, useState } from "react";

const CHARS = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const rand = (n: number) => Array.from({ length: n }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("");

// Minecraft §k style: a hidden score, redrawn as random characters.
export default function Obfuscated({ length = 3 }: { length?: number }) {
  const [text, setText] = useState("?".repeat(length));
  useEffect(() => {
    const id = setInterval(() => setText(rand(length)), 80);
    return () => clearInterval(id);
  }, [length]);
  return <span aria-label="hidden score" className="font-mono">{text}</span>;
}
