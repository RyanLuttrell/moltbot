import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Moltbot</h1>
        <p className="text-text-secondary mt-3 text-lg">
          Multi-channel AI assistant — managed for you
        </p>
      </div>
      <div className="flex gap-4">
        <Link
          href="/sign-up"
          className="bg-brand hover:bg-brand-dark rounded-lg px-6 py-3 font-medium text-white transition-colors"
        >
          Get started
        </Link>
        <Link
          href="/sign-in"
          className="bg-surface-tertiary hover:bg-border rounded-lg px-6 py-3 font-medium transition-colors"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
