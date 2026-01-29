import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { TRPCProvider } from "@/components/providers";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Moltbot",
  description: "Multi-channel AI assistant platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider appearance={{ baseTheme: dark }}>
      <html lang="en" className="dark">
        <body className="bg-surface text-text-primary min-h-screen antialiased">
          <TRPCProvider>{children}</TRPCProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
