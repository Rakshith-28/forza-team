import { SignOutButton } from "@/components/app/sign-out-button";

export default function NoAccessPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">No club access yet</h1>
        <p className="mt-2 text-muted-foreground">
          Your account isn&apos;t assigned to a club. Ask a club manager to invite you, then sign in
          again.
        </p>
        <div className="mt-6 flex justify-center">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
