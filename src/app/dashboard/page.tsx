"use client";

import { useAuth } from "@/contexts/AuthContext";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Loader2, Package, ScanLine, LineChart } from "lucide-react";

export default function DashboardPage() {
  const { userProfile, loading } = useAuth();

  if (loading || !userProfile) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Welcome, {userProfile?.email}</h1>
      <p className="text-muted-foreground">Here's a quick overview of your shop. Select an action to get started.</p>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
        { (userProfile?.role === 'admin' || userProfile?.role === 'shopkeeper') && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Billing</CardTitle>
                <ScanLine className="h-4 w-4 text-muted-foreground" />
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
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Manage Products</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground pt-4">Add, edit, and view your products.</p>
                <Button asChild className="mt-4">
                  <Link href="/dashboard/products">Go to Products</Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">View Reports</CardTitle>
                <LineChart className="h-4 w-4 text-muted-foreground" />
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
