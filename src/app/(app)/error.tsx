"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface only a digest reference; never render raw error text (avoids
    // leaking internals — Next already redacts server errors in production).
    console.error("Application error", error.digest ?? "");
  }, [error]);

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h2 className="font-sport text-xl font-bold text-foreground">Something went wrong</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        An unexpected error occurred. Please try again.
        {error.digest ? <span className="mt-1 block text-xs text-muted-foreground/70">Ref: {error.digest}</span> : null}
      </p>
      <Button onClick={reset} className="mt-5">
        Try again
      </Button>
    </div>
  );
}
