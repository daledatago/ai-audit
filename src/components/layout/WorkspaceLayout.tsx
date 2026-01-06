import * as React from "react";
import { NavLink, useParams } from "react-router-dom";

type Props = { children: React.ReactNode };

function TabLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "rounded-md px-3 py-2 text-sm",
          isActive ? "bg-muted font-medium" : "hover:bg-muted/60",
        ].join(" ")
      }
      end
    >
      {label}
    </NavLink>
  );
}

export default function WorkspaceLayout({ children }: Props) {
  const { id } = useParams();
  const wid = id ?? "";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm opacity-70">Workspace</div>
          <div className="font-semibold">{wid || "Unknown"}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-3">
        <TabLink to={`/workspaces/${wid}`} label="Overview" />
        <TabLink to={`/workspaces/${wid}/upload`} label="Upload" />
        <TabLink to={`/workspaces/${wid}/interview/new`} label="Interview" />
        <TabLink to={`/workspaces/${wid}/pipeline`} label="Pipeline" />
        <TabLink to={`/workspaces/${wid}/exports`} label="Exports" />
      </div>

      <div>{children}</div>
    </div>
  );
}
