import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { AcceptInviteForm } from "./accept-form";

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; token?: string }>;
}) {
  const { id, token } = await searchParams;

  if (!id || !token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invalid invitation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">This invitation link is missing its token.</p>
          <Link href="/sign-in" className="mt-4 inline-block text-sm text-primary underline-offset-4 hover:underline">
            Go to sign in
          </Link>
        </CardContent>
      </Card>
    );
  }

  return <AcceptInviteForm id={id} token={token} />;
}
