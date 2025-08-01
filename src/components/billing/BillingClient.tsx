
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
import { Search, Loader2, Plus, Minus, Trash2, CalendarClock, Printer } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { format, startOfDay, endOfDay } from 'date-fns';
import { Separator } from '../ui/separator';
import Link from 'next/link';

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
  const [todaysSales, setTodaysSales] = useState<Sale[]>([]);
  const [loadingTodaysSales, setLoadingTodaysSales] = useState(true);
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const handleNameSearch = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    
    const productsRef = collection(db, 'products');
    const nameQuery = query(
      productsRef, 
      where('name', '>=', term.toLowerCase()),
      where('name', '<=', term.toLowerCase() + '\uf8ff'),
      limit(10)
    );

    try {
        const nameSnapshot = await getDocs(nameQuery);
        const products: Product[] = [];
        const productIds = new Set<string>();

        nameSnapshot.forEach((doc) => {
            if(!productIds.has(doc.id)){
                products.push({ id: doc.id, ...doc.data() } as Product);
                productIds.add(doc.id);
            }
        });
        
        setSearchResults(products);
    } catch (error) {
      console.error("Error searching products by name:", error);
      toast({ variant: 'destructive', title: 'Search Error', description: 'Could not fetch products.' });
    } finally {
      setIsSearching(false);
    }
  }, [toast]);
  
  const handleBarcodeSearch = useCallback(async (barcode: string) => {
    if (!barcode) return;
    setIsSearching(true);
    const productsRef = collection(db, 'products');
    const barcodeQuery = query(productsRef, where('barcode', '==', barcode), limit(1));
    
    try {
        const barcodeSnapshot = await getDocs(barcodeQuery);
        if (!barcodeSnapshot.empty) {
            const product = { id: barcodeSnapshot.docs[0].id, ...barcodeSnapshot.docs[0].data() } as Product;
            addToCart(product);
            setSearchTerm('');
            setSearchResults([]);
        } else {
            toast({ variant: 'destructive', title: 'Not Found', description: 'No product found with that barcode.' });
        }
    } catch (error) {
        console.error("Error searching products by barcode:", error);
        toast({ variant: 'destructive', title: 'Search Error', description: 'Could not fetch product from barcode.' });
    } finally {
        setIsSearching(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (debouncedSearchTerm) {
      if (/^\d+$/.test(debouncedSearchTerm)) {
          // If the search term is numeric, it's likely a barcode.
          // We can choose to trigger barcode search directly here, but
          // the "Enter" key press is a more definitive action from a hardware scanner.
      } else {
          handleNameSearch(debouncedSearchTerm);
      }
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearchTerm, handleNameSearch]);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);


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
    if (event.key === 'Enter' && searchTerm) {
      event.preventDefault();
      // External scanners often send an "Enter" keystroke after the barcode.
      // We assume if it's all digits, it's a barcode scan.
      if (/^\d+$/.test(searchTerm)) {
          handleBarcodeSearch(searchTerm);
      } else {
          handleNameSearch(searchTerm);
      }
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
          <div className="space-y-4 no-print">
              <h3 className="text-xl font-semibold">New Bill / Customer</h3>
              <div className="flex gap-2">
                  <div className="relative w-full">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                          ref={searchInputRef}
                          placeholder="Scan barcode or search by name..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          onKeyDown={handleKeyDown}
                          className="pl-10"
                          disabled={isCheckingOut}
                      />
                  </div>
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
              <Card className="no-print">
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
                      <h4 className="font-semibold mb-2">Today's Receipts:</h4>
                      <div className="max-h-[400px] overflow-y-auto space-y-4">
                           {loadingTodaysSales ? (
                              <div className="flex justify-center items-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin" />
                              </div>
                           ) : todaysSales.length === 0 ? (
                              <p className="text-center text-muted-foreground py-8">No sales yet today.</p>
                           ) : (
                               todaysSales.map(sale => (
                                <div key={sale.id} className="border rounded-lg p-4" >
                                    <div className="flex justify-between items-center mb-2">
                                        <div>
                                            <p className="font-semibold">Receipt #{sale.id.slice(0, 6)}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {format(sale.createdAt.toDate(), 'p')} by <span className='capitalize'>{sale.createdByRole}</span>
                                            </p>
                                        </div>
                                         <div className="flex items-center gap-2 no-print">
                                            <Badge variant="outline">Total: {sale.totalAmount.toFixed(2)}</Badge>
                                            <Button asChild size="icon" variant="ghost">
                                                <Link href={`/dashboard/print/${sale.id}`} target="_blank">
                                                    <Printer className="h-4 w-4" />
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                    <Separator />
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Item</TableHead>
                                                <TableHead>Qty</TableHead>
                                                <TableHead className="text-right">Price</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {sale.items.map((item, index) => (
                                                <TableRow key={index} className={item.returned ? 'bg-muted/50' : ''}>
                                                    <TableCell className={item.returned ? 'line-through' : ''}>{item.name}</TableCell>
                                                    <TableCell className={item.returned ? 'line-through' : ''}>{item.quantity}</TableCell>
                                                    <TableCell className={`text-right ${item.returned ? 'line-through' : ''}`}>
                                                        {(item.sellingPrice * item.quantity).toFixed(2)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                               ))
                           )}
                      </div>
                  </CardContent>
              </Card>
          </div>
      </div>
  );
}
