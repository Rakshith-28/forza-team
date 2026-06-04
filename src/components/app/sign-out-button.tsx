"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      variant="ghost"
      size="sm"
      className={className}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await signOut();
        router.push("/sign-in");
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}
