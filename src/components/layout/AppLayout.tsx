import * as React from "react";
import { Link } from "react-router-dom";

type Props = { children: React.ReactNode };

export default function AppLayout({ children }: Props) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/workspaces" className="font-semibold">
            AI Audit
          </Link>
          <nav className="text-sm opacity-80">
            <Link to="/workspaces" className="hover:underline">
              Workspaces
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
