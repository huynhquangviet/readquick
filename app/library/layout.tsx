import { AuthButton } from "@/components/auth-button";
import { SettingsProvider } from "@/components/settings-provider";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { parseSettings } from "@/lib/settings/settings";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Suspense } from "react";

// Row-level security means only the signed-in user's settings come back.
async function WithSettings({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_settings")
    .select("speed, font_size, theme")
    .maybeSingle();
  const initial = parseSettings(
    data && { speed: data.speed, fontSize: data.font_size, theme: data.theme },
  );
  return <SettingsProvider initial={initial} themeSaved={data?.theme != null}>{children}</SettingsProvider>;
}

export default function LibraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense>
      <WithSettings>
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
      </WithSettings>
    </Suspense>
  );
}
