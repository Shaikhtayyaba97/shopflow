"use client";

import { useState, useRef } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product, CartItem } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { BarcodeScanner } from './BarcodeScanner';
import { Search, ScanLine, Loader2, Plus, Minus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

export function BillingClient() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSearch = async (term: string) => {
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    
    const productsRef = collection(db, 'products');
    const barcodeQuery = query(productsRef, where('barcode', '==', term));
    const nameQuery = query(productsRef, where('name', '>=', term), where('name', '<=', term + '\uf8ff'));

    try {
        const [barcodeSnapshot, nameSnapshot] = await Promise.all([getDocs(barcodeQuery), getDocs(nameQuery)]);
        const products: Product[] = [];
        const productIds = new Set<string>();

        barcodeSnapshot.forEach((doc) => {
            if(!productIds.has(doc.id)){
                products.push({ id: doc.id, ...doc.data() } as Product);
                productIds.add(doc.id);
            }
        });

        nameSnapshot.forEach((doc) => {
            if(!productIds.has(doc.id)){
                products.push({ id: doc.id, ...doc.data() } as Product);
                productIds.add(doc.id);
            }
        });
        
        setSearchResults(products);
        if (products.length === 1 && products[0].barcode === term) {
            addToCart(products[0]);
            setSearchTerm('');
            setSearchResults([]);
        }

    } catch (error) {
      console.error("Error searching products:", error);
      toast({ variant: 'destructive', title: 'Search Error', description: 'Could not fetch products.' });
    } finally {
      setIsSearching(false);
    }
  };
  
  const handleBarcodeScanned = (barcode: string) => {
    setIsScannerOpen(false);
    setSearchTerm(barcode);
    handleSearch(barcode);
  };

  const addToCart = (product: Product) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id);
      if (existingItem) {
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { ...product, quantity: 1 }];
    });
    setSearchTerm('');
    setSearchResults([]);
    searchInputRef.current?.focus();
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity < 1) {
        removeFromCart(productId);
        return;
    }
    setCart(cart.map(item => item.id === productId ? { ...item, quantity: newQuantity } : item));
  }

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.id !== productId));
  }

  const totalAmount = cart.reduce((total, item) => total + item.sellingPrice * item.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0 || !userProfile) return;
    setIsCheckingOut(true);
    try {
        const saleData = {
            items: cart.map(item => ({
                productId: item.id,
                name: item.name,
                quantity: item.quantity,
                sellingPrice: item.sellingPrice,
                purchasePrice: item.purchasePrice
            })),
            totalAmount: totalAmount,
            createdBy: userProfile.uid,
            createdAt: serverTimestamp()
        };
        await addDoc(collection(db, 'sales'), saleData);
        toast({ title: 'Checkout Successful', description: 'Sale has been recorded.' });
        setCart([]);
    } catch (error) {
        console.error("Error during checkout:", error);
        toast({ variant: 'destructive', title: 'Checkout Error', description: 'Could not complete the sale.' });
    } finally {
        setIsCheckingOut(false);
    }
  }


  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div className="space-y-4">
        <div className="flex gap-2">
            <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                    ref={searchInputRef}
                    placeholder="Search by name or barcode..."
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        handleSearch(e.target.value);
                    }}
                    className="pl-10"
                />
            </div>
            <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" size="icon">
                        <ScanLine className="h-5 w-5" />
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Scan Barcode</DialogTitle>
                    </DialogHeader>
                    {isScannerOpen && <BarcodeScanner onScan={handleBarcodeScanned} />}
                </DialogContent>
            </Dialog>
        </div>
        
        {isSearching && <Loader2 className="animate-spin mx-auto mt-4" />}
        {!isSearching && searchResults.length > 0 && (
          <div className="border rounded-md max-h-60 overflow-y-auto">
            {searchResults.map(product => (
              <div key={product.id} onClick={() => addToCart(product)} className="p-2 hover:bg-accent hover:text-accent-foreground cursor-pointer flex justify-between">
                <span>{product.name}</span>
                <span className="text-muted-foreground">${product.sellingPrice.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Cart</h3>
        <div className="border rounded-md">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {cart.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Cart is empty</TableCell></TableRow>
                    ) : cart.map(item => (
                        <TableRow key={item.id}>
                            <TableCell>{item.name}</TableCell>
                            <TableCell>
                                <div className="flex items-center gap-1">
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateQuantity(item.id, item.quantity - 1)}><Minus className="h-4 w-4" /></Button>
                                    <span className="w-4 text-center">{item.quantity}</span>
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateQuantity(item.id, item.quantity + 1)}><Plus className="h-4 w-4" /></Button>
                                </div>
                            </TableCell>
                            <TableCell className="text-right">${item.sellingPrice.toFixed(2)}</TableCell>
                            <TableCell className="text-right">${(item.sellingPrice * item.quantity).toFixed(2)}</TableCell>
                            <TableCell className="text-right">
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeFromCart(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
        {cart.length > 0 && (
            <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-2xl font-bold">Total: ${totalAmount.toFixed(2)}</div>
                <Button size="lg" onClick={handleCheckout} disabled={isCheckingOut}>
                    {isCheckingOut && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Checkout
                </Button>
            </div>
        )}
      </div>
    </div>
  );
}
