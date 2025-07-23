
"use client";

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Edit, Trash2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { ProductForm } from './ProductForm';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '../ui/badge';

export function ProductsList() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const { toast } = useToast();
    const { userProfile } = useAuth();
    const isAdmin = userProfile?.role === 'admin';

    useEffect(() => {
        const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const productsData: Product[] = [];
            querySnapshot.forEach((doc) => {
                productsData.push({ id: doc.id, ...doc.data() } as Product);
            });
            setProducts(productsData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching products: ", error);
            if (error.code === 'failed-precondition') {
                toast({
                    variant: 'destructive',
                    title: 'Database Index Missing',
                    description: 'Please create the required Firestore index to sort products.',
                });
            } else {
                 toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: 'Could not fetch products.',
                });
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [toast]);

    const handleEdit = (product: Product) => {
        setSelectedProduct(product);
        setIsEditModalOpen(true);
    };

    const handleDelete = async (productId: string) => {
        setDeletingId(productId);
        try {
            await deleteDoc(doc(db, "products", productId));
            toast({ title: "Success", description: "Product deleted." });
        } catch (error) {
            console.error("Error deleting product: ", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not delete product.' });
        } finally {
            setDeletingId(null);
        }
    };
    
    const handleProductUpdated = () => {
        setIsEditModalOpen(false);
        setSelectedProduct(null);
    }

    if (loading) {
        return (
            <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)}
            </div>
        );
    }

    return (
        <>
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Barcode</TableHead>
                    {isAdmin && <TableHead>Purchase Price</TableHead>}
                    <TableHead>Selling Price</TableHead>
                    <TableHead>Stock Qty</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {products.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={isAdmin ? 7 : 6} className="text-center text-muted-foreground py-8">No products found.</TableCell>
                    </TableRow>
                ) : products.map((product) => (
                    <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{product.barcode || 'N/A'}</TableCell>
                        {isAdmin && <TableCell>${product.purchasePrice?.toFixed(2) ?? '0.00'}</TableCell>}
                        <TableCell>${product.sellingPrice?.toFixed(2) ?? 'N/A'}</TableCell>
                        <TableCell>
                            {product.quantity > 0 ? (
                                product.quantity
                            ) : (
                                <Badge variant="destructive">Out of Stock</Badge>
                            )}
                        </TableCell>
                        <TableCell>{product.createdAt ? format(product.createdAt.toDate(), 'PP') : 'N/A'}</TableCell>
                        <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(product)}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                                {isAdmin && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" disabled={deletingId === product.id}>
                                            {deletingId === product.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete the product.
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDelete(product.id)}>Continue</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                                )}
                            </div>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>

        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Product</DialogTitle>
                </DialogHeader>
                <ProductForm
                    isEditMode
                    productToEdit={selectedProduct}
                    onProductUpdated={handleProductUpdated}
                />
            </DialogContent>
        </Dialog>
        </>
    );
}
