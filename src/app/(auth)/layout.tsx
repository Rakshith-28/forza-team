export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="text-xl font-semibold tracking-tight text-primary">Forza Team</span>
        </div>
        {children}
      </div>
    </div>
  );
}
