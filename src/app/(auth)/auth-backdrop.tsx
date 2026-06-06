"use client";

import { usePathname } from "next/navigation";

/**
 * Auth-screen backdrop. On the sign-in page it shows the sports flat-lay image
 * (public/auth-bg.jpg) under a light scrim so the centered card + wordmark stay
 * readable (WCAG); a green gradient sits beneath as a graceful fallback if the
 * image is missing. Other auth pages keep the original subtle muted background.
 * Scoped here (not the shared layout) so only /sign-in gets the photo.
 */
export function AuthBackdrop() {
  const pathname = usePathname();
  const isSignIn = pathname === "/sign-in";

  if (!isSignIn) {
    return <div aria-hidden className="absolute inset-0 bg-muted/30" />;
  }

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      {/* Fallback sport-green gradient (shows if the photo isn't present). */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-background to-primary/10" />
      {/* The background photo — cover + center keeps it responsive on every device. */}
      <div className="absolute inset-0 bg-[url('/auth-bg.jpg')] bg-cover bg-center bg-no-repeat" />
      {/* Legibility scrim. */}
      <div className="absolute inset-0 bg-background/65 backdrop-blur-[1px]" />
    </div>
  );
}
