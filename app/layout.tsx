import "./globals.css";

import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Thron AI Assistant - Deepest AI Assistant",
  description:
    "Thron AI Assistant is a free, alternative to OpenAI's Deep Research, Google's Gemini, and Anthropic's Claude Research. This advanced AI research assistant delivers comprehensive market analysis, competitive intelligence, and academic research capabilities. Experience enterprise-grade research automation with features like recursive exploration, multi-source validation, and structured insights extraction. Perfect for startups, researchers, and businesses seeking a transparent, customizable, and powerful research solution without vendor lock-in. Dive deep into any topic with our state-of-the-art natural language processing and automated insight generation.",
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
