import { AuthBackdrop } from "./auth-backdrop";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex flex-1 items-center justify-center px-4 py-12">
      <AuthBackdrop />
      <div className="relative w-full max-w-md">
        {/* Brand wordmark — matches the in-app header (Oswald / font-sport, two-tone). */}
        <div className="mb-8 text-center">
          <span className="font-sport text-3xl font-bold uppercase tracking-[0.3em] sm:text-4xl">
            <span className="text-foreground">Forza</span>
            <span className="ml-[0.3em] text-primary">Team</span>
          </span>
          <p className="mt-2.5 text-sm text-muted-foreground">Soccer club management, all in one place.</p>
        </div>
        {children}
      </div>
    </div>
  );
}
