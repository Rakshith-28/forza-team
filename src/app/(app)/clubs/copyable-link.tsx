"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** A read-only URL field with a copy button — used to share invite links when
 * email delivery isn't configured. Falls back to manual selection if the
 * clipboard API is blocked. */
export function CopyableLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <Input readOnly value={url} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard blocked — the field is selectable for manual copy */
          }
        }}
      >
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
