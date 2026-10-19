"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ConnectButton from "@/components/ui/ConnectButton";
import NetworkBadge from "@/components/botchain/NetworkBadge";
import { app } from "@/lib/app-config";

export type NavItem = { href: string; label: string };

interface PageShellProps {
  children: React.ReactNode;
  nav?: NavItem[];
  title?: string;
  description?: string;
}

/**
 * Chamber shell: a split for/against bar under the masthead, then the record.
 *
 * The bar is decorative here and meaningful on a proposal page, which is the point — the device
 * establishes that this interface measures two opposed quantities rather than progress toward
 * one. Vote-locking is stated in the footer because it is the thing most likely to surprise
 * someone: voting deposits tokens, and they come back when the proposal closes.
 */
export default function PageShell({ children, nav = [], title, description }: PageShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col" style={{ minHeight: "100dvh" }}>
      <header className="flex-shrink-0">
        <div className="mx-auto w-full px-5 md:px-8 py-4 flex items-center justify-between gap-4" style={{ maxWidth: "1020px" }}>
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <svg width="22" height="18" viewBox="0 0 22 18" aria-hidden="true">
              <rect x="1" y="4" width="8" height="12" fill="var(--for)" />
              <rect x="13" y="9" width="8" height="7" fill="var(--against)" />
            </svg>
            <span className="text-[17px] font-semibold tracking-[-0.03em]">{app.name}</span>
          </Link>
          <div className="flex items-center gap-3">
            {nav.length > 1 && (
              <nav className="hidden sm:flex items-center gap-4 mr-1">
                {nav.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
                      className="nav-link text-[13px] no-underline"
                      style={{ color: active ? "var(--accent)" : "var(--text-tertiary)" }}>
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            )}
            <NetworkBadge />
            <div style={{ width: "155px" }}><ConnectButton /></div>
          </div>
        </div>

        {/* Two opposed quantities, established as the visual language of the whole app. */}
        <div className="flex" style={{ height: "3px" }} aria-hidden="true">
          <div style={{ flex: "0 0 62%", background: "var(--for)" }} />
          <div style={{ flex: 1, background: "var(--against)" }} />
        </div>
      </header>

      <main className="flex-1 mx-auto w-full px-5 md:px-8 py-9" style={{ maxWidth: "1020px" }}>
        {title && <h1 className="text-[30px] md:text-[36px]" style={{ color: "var(--text-primary)" }}>{title}</h1>}
        {description && (
          <p className="mt-3 text-[15px]" style={{ color: "var(--text-secondary)", maxWidth: "62ch" }}>
            {description}
          </p>
        )}
        <div className={title || description ? "mt-8" : ""}>{children}</div>
      </main>

      <footer className="flex-shrink-0 mx-auto w-full px-5 md:px-8 py-7" style={{ maxWidth: "1020px", borderTop: "1px solid var(--border-subtle)" }}>
        <p className="text-[12px] mb-3" style={{ color: "var(--text-tertiary)" }}>
          Voting deposits your tokens for the life of the proposal and returns them when it closes.
          That is what makes the tally mean something: weight cannot be moved to a second address
          and voted twice.
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px]">
          <span style={{ color: "var(--text-secondary)" }}>Built on BOT Chain</span>
          <a href="https://botchain.ai" target="_blank" rel="noreferrer" style={{ color: "var(--text-tertiary)" }}>botchain.ai</a>
          <a href="https://scan.botchain.ai" target="_blank" rel="noreferrer" style={{ color: "var(--text-tertiary)" }}>BOT Chain Explorer</a>
        </div>
      </footer>
    </div>
  );
}
