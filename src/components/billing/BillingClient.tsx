
"use client";

import { useState, useRef, useEffect, KeyboardEvent, useCallback } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, runTransaction, doc, onSnapshot, Timestamp, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product, CartItem, Sale } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { BarcodeScanner } from './BarcodeScanner';
import { Search, ScanLine, Loader2, Plus, Minus, Trash2, CalendarClock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from '../ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { format, startOfDay, endOfDay } from 'date-fns';

// Debounce hook
function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

export function BillingClient() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [todaysSales, setTodaysSales] = useState<Sale[]>([]);
  const [loadingTodaysSales, setLoadingTodaysSales] = useState(true);
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const handleSearch = useCallback(async (term: string) => {
    if (term.trim().length < 2 && !/^\d+$/.test(term)) { // Allow single-digit barcode search but require 2+ for name
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    
    const productsRef = collection(db, 'products');
    const barcodeQuery = query(productsRef, where('barcode', '==', term));
    // Updated to be case-insensitive by searching a range.
    const nameQuery = query(
      productsRef, 
      where('name', '>=', term), 
      where('name', '<=', term + '\uf8ff'),
      limit(10) // Limit suggestions for performance
    );

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

        // If barcode scan adds an item, we are done.
        if (products.length === 1 && products[0].barcode === term) {
            addToCart(products[0]);
            setSearchTerm('');
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        nameSnapshot.forEach((doc) => {
            if(!productIds.has(doc.id)){
                products.push({ id: doc.id, ...doc.data() } as Product);
                productIds.add(doc.id);
            }
        });
        
        setSearchResults(products);

        if (products.length === 0) {
           if (searchTerm) { // Only show toast if user actually searched
             toast({ variant: 'destructive', title: 'Not Found', description: 'No product found with that barcode or name.' });
           }
        }
    } catch (error) {
      console.error("Error searching products:", error);
      toast({ variant: 'destructive', title: 'Search Error', description: 'Could not fetch products.' });
    } finally {
      setIsSearching(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (debouncedSearchTerm) {
      handleSearch(debouncedSearchTerm);
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearchTerm, handleSearch]);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);


  useEffect(() => {
    if (isScannerOpen) {
      const getCameraPermission = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          setHasCameraPermission(true);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (error) {
          console.error('Error accessing camera:', error);
          setHasCameraPermission(false);
          toast({
            variant: 'destructive',
            title: 'Camera Access Denied',
            description: 'Please enable camera permissions in your browser settings to use the scanner.',
          });
        }
      };
      getCameraPermission();
    }
  }, [isScannerOpen, toast]);

    useEffect(() => {
        setLoadingTodaysSales(true);
        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());

        const q = query(
            collection(db, 'sales'),
            where('createdAt', '>=', Timestamp.fromDate(todayStart)),
            where('createdAt', '<=', Timestamp.fromDate(todayEnd)),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const salesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale));
            setTodaysSales(salesData);
            setLoadingTodaysSales(false);
        }, (error) => {
            console.error("Error fetching today's sales:", error);
            setLoadingTodaysSales(false);
        });

        return () => unsubscribe();
    }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSearch(searchTerm);
    }
  };
  
  const handleBarcodeScanned = (barcode: string) => {
    setIsScannerOpen(false);
    setSearchTerm(barcode);
    handleSearch(barcode);
     if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
    }
  };

  const addToCart = (product: Product) => {
    if (product.quantity <= 0) {
        toast({ variant: 'destructive', title: 'Out of Stock', description: `${product.name} is currently out of stock.`});
        return;
    }

    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id);
      if (existingItem) {
        const newQuantity = existingItem.quantityInCart + 1;
        if (newQuantity > product.quantity) {
          if (product.quantity === 1) {
             toast({ variant: 'destructive', title: 'Stock Limit Reached', description: `Only 1 item left in stock`});
          } else {
             toast({ variant: 'destructive', title: 'Stock Limit Reached', description: `You can't add more than the available stock of ${product.quantity}`});
          }
          return prevCart;
        }
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, quantityInCart: newQuantity } : item
        );
      }
      return [...prevCart, { ...product, quantityInCart: 1 }];
    });
    setSearchTerm('');
    setSearchResults([]);
    searchInputRef.current?.focus();
  };

  const updateQuantity = (productId: string, newQuantityInCart: number) => {
    const itemInCart = cart.find(item => item.id === productId);
    if (!itemInCart) return;

    if (newQuantityInCart < 1) {
      removeFromCart(productId);
      return;
    }
    
    // Check against the total available stock for the product.
    if (newQuantityInCart > itemInCart.quantity) {
        toast({ variant: 'destructive', title: 'Stock Limit Reached', description: `You can't add more than the available stock of ${itemInCart.quantity}`});
        return;
    }

    setCart(cart.map(item =>
      item.id === productId
        ? { ...item, quantityInCart: newQuantityInCart }
        : item
    ));
  }


  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.id !== productId));
  }

  const totalAmount = cart.reduce((total, item) => total + item.sellingPrice * item.quantityInCart, 0);

  const handleCheckout = async () => {
    if (cart.length === 0 || !userProfile) return;
    setIsCheckingOut(true);

    try {
        await runTransaction(db, async (transaction) => {
            const productRefs = cart.map(item => doc(db, 'products', item.id));
            const productDocs = await Promise.all(productRefs.map(ref => transaction.get(ref)));
            const productUpdates: { ref: any; newQuantity: number }[] = [];

            for (let i = 0; i < cart.length; i++) {
                const item = cart[i];
                const productDoc = productDocs[i];

                if (!productDoc.exists()) {
                    throw new Error(`Product ${item.name} not found.`);
                }

                const currentQuantity = productDoc.data().quantity;
                if (currentQuantity < item.quantityInCart) {
                    throw new Error(`Not enough stock for ${item.name}. Only ${currentQuantity} left.`);
                }

                const newQuantity = currentQuantity - item.quantityInCart;
                productUpdates.push({ ref: productRefs[i], newQuantity });
            }

            // All reads are done. Now perform writes.
            const saleData = {
                items: cart.map(item => ({
                    productId: item.id,
                    name: item.name,
                    quantity: item.quantityInCart,
                    sellingPrice: item.sellingPrice,
                    purchasePrice: item.purchasePrice || 0
                })),
                totalAmount: totalAmount,
                createdBy: userProfile.uid,
                createdByName: userProfile.email,
                createdByRole: userProfile.role,
                createdAt: serverTimestamp()
            };
            
            for (const update of productUpdates) {
                transaction.update(update.ref, { quantity: update.newQuantity });
            }

            const salesCollectionRef = collection(db, 'sales');
            transaction.set(doc(salesCollectionRef), saleData);
        });
        
        toast({ title: 'Checkout Successful', description: 'Sale has been recorded and stock updated.' });
        setCart([]);
        setSearchTerm('');
        setSearchResults([]);
        searchInputRef.current?.focus();
    } catch (error: any) {
        console.error("Error during checkout:", error);
        toast({ variant: 'destructive', title: 'Checkout Error', description: error.message || 'Could not complete the sale.' });
    } finally {
        setIsCheckingOut(false);
    }
  }

  const { todaysTotalRevenue, todaysTotalItems } = todaysSales.reduce((acc, sale) => {
        sale.items.forEach(item => {
            if (!item.returned) {
                acc.todaysTotalRevenue += item.sellingPrice * item.quantity;
                acc.todaysTotalItems += item.quantity;
            }
        });
        return acc;
    }, { todaysTotalRevenue: 0, todaysTotalItems: 0 });

  return (
      <div className="space-y-8">
          {/* Top Section: New Bill */}
          <div className="space-y-4">
              <h3 className="text-xl font-semibold">New Bill / Customer</h3>
              <div className="flex gap-2">
                  <div className="relative w-full">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                          ref={searchInputRef}
                          placeholder="Search by name or scan a barcode..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          onKeyDown={handleKeyDown}
                          className="pl-10"
                          disabled={isCheckingOut}
                      />
                  </div>
                  <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
                      <DialogTrigger asChild>
                          <Button variant="outline" size="icon" disabled={isCheckingOut}>
                              <ScanLine className="h-5 w-5" />
                          </Button>
                      </DialogTrigger>
                      <DialogContent>
                          <DialogHeader>
                              <DialogTitle>Scan Barcode</DialogTitle>
                          </DialogHeader>
                          {isScannerOpen && (
                              <div>
                                  <video ref={videoRef} className="w-full aspect-video rounded-md bg-black" autoPlay muted playsInline />
                                  {hasCameraPermission === false && (
                                      <Alert variant="destructive" className="mt-4">
                                          <AlertTitle>Camera Access Required</AlertTitle>
                                          <AlertDescription>
                                              Please allow camera access in your browser to use this feature.
                                          </AlertDescription>
                                      </Alert>
                                  )}
                                  {hasCameraPermission && <BarcodeScanner onScan={handleBarcodeScanned} videoRef={videoRef} />}
                              </div>
                          )}
                      </DialogContent>
                  </Dialog>
              </div>

              {isSearching && <Loader2 className="animate-spin mx-auto mt-4" />}
              {!isSearching && searchResults.length > 0 && searchTerm && (
                  <div className="border rounded-md max-h-60 overflow-y-auto absolute z-10 bg-card w-[calc(100%-4rem)]">
                      {searchResults.map(product => (
                          <div key={product.id} onClick={() => addToCart(product)} className="p-2 hover:bg-accent hover:text-accent-foreground cursor-pointer flex justify-between">
                              <div>
                                  <span>{product.name}</span>
                                  <span className="ml-2">
                                      {product.quantity > 0 ?
                                          <Badge variant="outline">{product.quantity} in stock</Badge> :
                                          <Badge variant="destructive">Out of Stock</Badge>
                                      }
                                  </span>
                              </div>
                              <span className="text-muted-foreground">{product.sellingPrice}</span>
                          </div>
                      ))}
                  </div>
              )}

              <div className="space-y-4 pt-4">
                  <h3 className="text-lg font-semibold">Current Bill</h3>
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
                                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Cart is empty. Add products to start a new bill.</TableCell></TableRow>
                              ) : cart.map(item => (
                                  <TableRow key={item.id}>
                                      <TableCell>{item.name}</TableCell>
                                      <TableCell>
                                          <div className="flex items-center gap-1">
                                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateQuantity(item.id, item.quantityInCart - 1)} disabled={isCheckingOut}><Minus className="h-4 w-4" /></Button>
                                              <span className="w-4 text-center">{item.quantityInCart}</span>
                                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateQuantity(item.id, item.quantityInCart + 1)} disabled={isCheckingOut}><Plus className="h-4 w-4" /></Button>
                                          </div>
                                      </TableCell>
                                      <TableCell className="text-right">{item.sellingPrice}</TableCell>
                                      <TableCell className="text-right">{(item.sellingPrice * item.quantityInCart)}</TableCell>
                                      <TableCell className="text-right">
                                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeFromCart(item.id)} disabled={isCheckingOut}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                      </TableCell>
                                  </TableRow>
                              ))}
                          </TableBody>
                      </Table>
                  </div>
                  {cart.length > 0 && (
                      <div className="flex justify-between items-center pt-4 border-t">
                          <div className="text-2xl font-bold">Total: {totalAmount}</div>
                          <Button size="lg" onClick={handleCheckout} disabled={isCheckingOut || cart.length === 0}>
                              {isCheckingOut && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Finalize & Checkout
                          </Button>
                      </div>
                  )}
              </div>
          </div>
          
          {/* Bottom Section: Today's Sales Summary */}
          <div className="space-y-4">
              <Card>
                  <CardHeader>
                      <div className="flex items-center gap-2">
                          <CalendarClock className="h-6 w-6" />
                          <CardTitle>Today's Sales Summary</CardTitle>
                      </div>
                      <CardDescription>A live overview of all sales made today.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      <div className="flex justify-between items-center mb-4 pb-4 border-b">
                          <div>
                              <p className="text-sm text-muted-foreground">Total Items Sold Today</p>
                              <p className="text-2xl font-bold">{todaysTotalItems}</p>
                          </div>
                          <div>
                              <p className="text-sm text-muted-foreground">Total Revenue Today</p>
                              <p className="text-2xl font-bold">{todaysTotalRevenue.toFixed(2)}</p>
                          </div>
                      </div>
                      <h4 className="font-semibold mb-2">All Items Sold Today:</h4>
                      <div className="max-h-[400px] overflow-y-auto">
                           {loadingTodaysSales ? (
                              <div className="flex justify-center items-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin" />
                              </div>
                           ) : todaysSales.length === 0 ? (
                              <p className="text-center text-muted-foreground py-8">No sales yet today.</p>
                           ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Time</TableHead>
                                        <TableHead>Item</TableHead>
                                        <TableHead>Qty</TableHead>
                                        <TableHead>Sold By</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {todaysSales.flatMap(sale => sale.items.map((item, index) => (
                                        <TableRow key={`${sale.id}-${index}`} className={item.returned ? 'bg-muted/50' : ''}>
                                            <TableCell className={item.returned ? 'line-through' : ''}>{format(sale.createdAt.toDate(), 'p')}</TableCell>
                                            <TableCell className={item.returned ? 'line-through' : ''}>{item.name}</TableCell>
                                            <TableCell className={item.returned ? 'line-through' : ''}>{item.quantity}</TableCell>
                                            <TableCell className={`capitalize ${item.returned ? 'line-through' : ''}`}>{sale.createdByRole}</TableCell>
                                            <TableCell className={`text-right ${item.returned ? 'line-through' : ''}`}>
                                                {(item.sellingPrice * item.quantity).toFixed(2)}
                                            </TableCell>
                                        </TableRow>
                                    )))}
                                </TableBody>
                            </Table>
                           )}
                      </div>
                  </CardContent>
              </Card>
          </div>
      </div>
  );
}
