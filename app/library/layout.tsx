import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import Link from "next/link";
import { Suspense } from "react";

export default function LibraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-svh flex flex-col">
      <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
        <div className="w-full max-w-3xl flex justify-between items-center p-3 px-5 text-sm">
          <Link href="/library" className="font-semibold">
            readquick
          </Link>
          <div className="flex items-center gap-4">
            <Suspense>
              <AuthButton />
            </Suspense>
            <ThemeSwitcher />
          </div>
        </div>
      </nav>
      <main className="flex-1 w-full max-w-3xl mx-auto p-5">{children}</main>
    </div>
  );
}
