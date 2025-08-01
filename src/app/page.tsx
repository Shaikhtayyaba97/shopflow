"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [user, loading, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <div className="flex items-center space-x-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <h1 className="text-4xl font-bold text-primary">ShopFlow</h1>
      </div>
      <p className="mt-4 text-muted-foreground">Loading your experience...</p>
    </main>
  );
}
