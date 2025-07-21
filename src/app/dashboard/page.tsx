"use client";

import { useAuth } from "@/contexts/AuthContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Loader2, Package, ScanLine, LineChart, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function DashboardPage() {
  const { userProfile, loading } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (loading || !userProfile) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const welcomeMessage = userProfile.role === 'admin' 
    ? "Welcome, Boss" 
    : "Welcome, A to Z cosmatic";

  return (
    <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">{welcomeMessage}</h1>
            <Button variant="outline" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
            </Button>
        </div>
      <p className="text-muted-foreground">Here's a quick overview of your shop. Select an action to get started.</p>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
        { (userProfile?.role === 'admin' || userProfile?.role === 'shopkeeper') && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span>Billing</span>
                    <ScanLine className="h-4 w-4 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground pt-4">Start a new sale by scanning or searching products.</p>
                <Button asChild className="mt-4">
                  <Link href="/dashboard/billing">Go to Billing</Link>
                </Button>
              </CardContent>
            </Card>
        )}
        {userProfile?.role === 'admin' && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span>Manage Products</span>
                    <Package className="h-4 w-4 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                 <p className="text-sm text-muted-foreground pt-4">Add, edit, and view your products.</p>
                <Button asChild className="mt-4">
                  <Link href="/dashboard/products">Go to Products</Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span>View Reports</span>
                    <LineChart className="h-4 w-4 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground pt-4">Analyze sales and profit reports.</p>
                <Button asChild className="mt-4">
                  <Link href="/dashboard/reports">Go to Reports</Link>
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
