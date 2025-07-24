
"use client";

import { AppSidebar } from '@/components/AppSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Menu, Package, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import type { UserProfile } from '@/types';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, userProfile } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !userProfile) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getInitials = (email: string | null | undefined) => {
    if (!email) return 'U';
    return email.charAt(0).toUpperCase();
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <AppSidebar userProfile={userProfile} />
      <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button size="icon" variant="outline" className="sm:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="sm:max-w-xs">
              <SheetHeader className="mb-4">
                  <SheetTitle>
                     <Link
                        href="/dashboard"
                        className="group flex items-center gap-2 text-lg font-semibold"
                      >
                        <Package className="h-6 w-6 transition-all group-hover:scale-110" />
                        <span>ShopFlow</span>
                      </Link>
                  </SheetTitle>
                  <SheetDescription>
                    Navigate through the application sections.
                  </SheetDescription>
              </SheetHeader>
              <nav className="grid gap-6 text-lg font-medium">
                <AppSidebar.MobileLinks userProfile={userProfile} />
              </nav>
            </SheetContent>
          </Sheet>
          <div className="relative ml-auto flex-1 md:grow-0">
             {/* This can be a search bar in the future */}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="overflow-hidden rounded-full"
              >
                <Avatar>
                  <AvatarImage src="#" alt="@user" />
                  <AvatarFallback>{getInitials(userProfile.email)}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
          {children}
        </main>
      </div>
    </div>
  );
}
