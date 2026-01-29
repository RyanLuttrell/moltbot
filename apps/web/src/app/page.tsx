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
        <h1 className="font-display text-4xl font-bold tracking-tight">
          Moltbot<span className="text-brand">.</span>
        </h1>
        <p className="mt-3 text-lg text-text-secondary">
          Multi-channel AI assistant — managed for you
        </p>
      </div>
      <div className="flex gap-4">
        <Link
          href="/sign-up"
          className="rounded-full bg-brand px-6 py-3 font-medium text-white transition-colors hover:bg-brand-dark"
        >
          Get started
        </Link>
        <Link
          href="/sign-in"
          className="rounded-full border border-border px-6 py-3 font-medium transition-colors hover:border-brand hover:text-brand"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
