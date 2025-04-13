'use client';

import { Chat } from '@/components/chat/chat';
import { Header } from '@/components/chat/site-header';

export default function ResearchPage() {
  return (
    <main className="flex flex-col h-screen items-center p-4 bg-black">
      <Header />
      <Chat id="research" initialMessages={[]} />
    </main>
  );
}
