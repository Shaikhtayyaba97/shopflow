"use client"

import { ProductForm } from '@/components/products/ProductForm';
import { ProductsList } from '@/components/products/ProductsList';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2 } from 'lucide-react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

export default function ProductsPage() {
    const { userProfile, loading } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState("all");
    const { toast } = useToast();

    useEffect(() => {
        if (!loading && userProfile?.role !== 'admin') {
            router.push('/dashboard');
        }
    }, [userProfile, loading, router]);
    
    // This effect is to check for the required Firestore index.
    useEffect(() => {
        if (userProfile?.role === 'admin') {
            const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
            const unsubscribe = onSnapshot(q, 
                (snapshot) => { /* Do nothing, just need to trigger the listener */ },
                (error) => {
                    if (error.code === 'failed-precondition') {
                        toast({
                            variant: 'destructive',
                            title: 'Database Index Missing',
                            description: 'A Firestore index is required for sorting. Please check the browser console for a link to create it automatically.',
                            duration: 15000
                        });
                        console.error("Firestore Index Error: ", error.message);
                    }
                }
            );
            return () => unsubscribe();
        }
    }, [userProfile, toast]);

    if (loading || !userProfile || userProfile.role !== 'admin') {
        return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    const handleProductAdded = () => {
      setActiveTab("all");
    }
  
    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex items-center">
            <TabsList>
              <TabsTrigger value="all">All Products</TabsTrigger>
              <TabsTrigger value="new">Add New</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="all">
            <Card>
              <CardHeader>
                <CardTitle>Products</CardTitle>
                <CardDescription>Manage your products here. View, edit, or delete existing products.</CardDescription>
              </CardHeader>
              <CardContent>
                <ProductsList />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="new">
            <Card>
              <CardHeader>
                <CardTitle>Add Product</CardTitle>
                <CardDescription>Add a new product to your inventory.</CardDescription>
              </CardHeader>
              <CardContent>
                <ProductForm onProductAdded={handleProductAdded} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
    );
}
