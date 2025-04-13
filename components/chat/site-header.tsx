import Image from "next/image";
import Link from "next/link";
import { Twitter } from "lucide-react";

export function Header() {
  return (
    <>
      <header className="pt-4 fixed left-12 top-0 z-50 w-full translate-y-[-1rem] animate-fade-in border-b border-zinc-800 backdrop-blur-[12px] [--animation-delay:600ms]">
        <div className="container flex h-[3.5rem] items-center">
          {/* Left spacer to help with centering */}
          <div className="w-10 flex-none"></div>
          
          {/* Centered logo */}
          <div className="flex-1 flex justify-center">
            <Link
              className="flex items-center text-md text-white"
              href="https://thronai.org/"
              target="_blank"
            >
              <Image
                src="/logo-text.png"
                alt="Thron Logo"
                width={400}
                height={100}
                className="w-48 invert opacity-30 hover:opacity-90 transition-opacity duration-300"
              />
            </Link>
          </div>
          
          {/* Twitter icon on the right */}
          <div className="w-10 flex-none">
            <Link
              href="https://x.com/thron"
              target="_blank"
              className="flex items-center justify-center w-10 h-10 text-white hover:text-thron transition-colors rounded-full hover:bg-thron/10"
            >
              <Twitter className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
