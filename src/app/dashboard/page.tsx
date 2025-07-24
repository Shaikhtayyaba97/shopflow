
"use client";

import { useAuth } from "@/contexts/AuthContext";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Loader2, Package, ScanLine, LineChart, LogOut, Archive, CircleDollarSign, ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import type { Product } from "@/types";

export default function DashboardPage() {
  const { userProfile, loading } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  useEffect(() => {
    if (userProfile?.role === 'admin') {
      const unsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
        const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        setProducts(productsData);
        setSummaryLoading(false);
      }, (error) => {
        console.error("Error fetching product data for summary:", error);
        setSummaryLoading(false);
      });
      return () => unsubscribe();
    } else {
        setSummaryLoading(false);
    }
  }, [userProfile]);

  const stockSummary = useMemo(() => {
    if (userProfile?.role !== 'admin') return null;

    const totalStock = products.reduce((sum, product) => sum + product.quantity, 0);
    const totalBuyingCost = products.reduce((sum, product) => sum + (product.purchasePrice * product.quantity), 0);
    const totalSellingValue = products.reduce((sum, product) => sum + (product.sellingPrice * product.quantity), 0);

    return { totalStock, totalBuyingCost, totalSellingValue };
  }, [products, userProfile]);

  if (loading || !userProfile) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const welcomeMessage = userProfile.role === 'admin' 
    ? "Welcome, Boss" 
    : "Welcome, A to Z cosmatic";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-2">
              <h1 className="text-2xl font-bold">{welcomeMessage}</h1>
          </div>
        <p className="text-muted-foreground">Here's a quick overview of your shop. Select an action to get started.</p>
        
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Billing</CardTitle>
              <CardDescription>Start a new sale by scanning or searching products.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="mt-4">
                <Link href="/dashboard/billing">Go to Billing</Link>
              </Button>
            </CardContent>
          </Card>
        
          <Card>
            <CardHeader>
              <CardTitle>Manage Products</CardTitle>
              <CardDescription>Add, edit, and view your products.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="mt-4">
                <Link href="/dashboard/products">Go to Products</Link>
              </Button>
            </CardContent>
          </Card>

          {userProfile?.role === 'admin' && (
            <Card>
              <CardHeader>
                <CardTitle>View Reports</CardTitle>
                <CardDescription>Analyze sales and profit reports.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="mt-4">
                  <Link href="/dashboard/reports">Go to Reports</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {userProfile?.role === 'admin' && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Inventory Summary</h2>
          {summaryLoading ? (
             <div className="flex items-center justify-center h-24">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
             </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Stock Quantity</CardTitle>
                  <Archive className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stockSummary?.totalStock}</div>
                  <p className="text-xs text-muted-foreground">Total items across all products</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Buying Cost</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stockSummary?.totalBuyingCost.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">Total cost of all items in stock</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Selling Value</CardTitle>
                  <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stockSummary?.totalSellingValue.toFixed(2)}</div>
                   <p className="text-xs text-muted-foreground">Potential revenue from all items</p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
