import { HTMLAttributes } from "react";

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  noPadding?: boolean;
}

/** A record entry, flat and plain so the tallies inside carry the weight. */
export default function Panel({ elevated, noPadding, children, className = "", style, ...props }: PanelProps) {
  return (
    <div
      className={[noPadding ? "" : "p-5", className].join(" ")}
      style={{
        background: elevated ? "var(--bg-elevated)" : "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "3px",
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
