
"use client"

import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, Timestamp, orderBy, runTransaction, doc, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Sale, SaleItem } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { format, startOfDay, endOfDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon, Loader2, Undo2, Edit } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '../ui/badge';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SaleItemEditForm } from './SaleItemEditForm';

interface EnrichedSaleItem extends SaleItem {
  profit: number;
  saleId: string;
  itemIndex: number;
}

interface EnrichedSale extends Omit<Sale, 'items'> {
  items: EnrichedSaleItem[];
  totalProfit: number;
}

interface GroupedSales {
    [date: string]: EnrichedSale[];
}

export function SalesClient() {
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [salesByDate, setSalesByDate] = useState<GroupedSales>({});
    const [loading, setLoading] = useState(false);
    const [isReturning, setIsReturning] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'single' | 'all'>('single');
    const { userProfile } = useAuth();
    const { toast } = useToast();
    const isAdmin = userProfile?.role === 'admin';
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedSaleItem, setSelectedSaleItem] = useState<{sale: EnrichedSale; item: EnrichedSaleItem} | null>(null);

    const fetchSales = (mode: 'single' | 'all') => {
        if (!userProfile) return;
        if (mode === 'single' && !date) {
            toast({ variant: 'destructive', title: 'No Date Selected', description: 'Please select a date for the report.' });
            return;
        }

        setLoading(true);
        setViewMode(mode);

        let q;
        if (mode === 'single' && date) {
            const startDate = startOfDay(date);
            const endDate = endOfDay(date);
            q = query(
                collection(db, 'sales'),
                where('createdAt', '>=', Timestamp.fromDate(startDate)),
                where('createdAt', '<=', Timestamp.fromDate(endDate)),
                orderBy('createdAt', 'desc')
            );
        } else { // mode === 'all'
            q = query(collection(db, 'sales'), orderBy('createdAt', 'desc'));
        }

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const groupedSales: GroupedSales = {};

            querySnapshot.docs.forEach(docSnapshot => {
                const sale = { id: docSnapshot.id, ...docSnapshot.data() } as Sale;
                const dateKey = format(sale.createdAt.toDate(), 'yyyy-MM-dd');
                
                if (!groupedSales[dateKey]) {
                    groupedSales[dateKey] = [];
                }
                
                let totalProfit = 0;
                const enrichedItems = sale.items.map((item, itemIndex) => {
                    const profit = (item.sellingPrice - (item.purchasePrice || 0)) * item.quantity;
                    if (!item.returned) {
                        totalProfit += profit;
                    }
                    return { ...item, profit, saleId: sale.id, itemIndex };
                });
                
                groupedSales[dateKey].push({ ...sale, items: enrichedItems, totalProfit });
            });
            
            setSalesByDate(groupedSales);
            setLoading(false);

        }, (error: any) => {
             if (error.code === 'failed-precondition') {
                toast({
                    variant: 'destructive',
                    title: 'Database Index Missing',
                    description: 'A Firestore index is required for this query. Please check the browser console for a link to create it automatically.',
                    duration: 15000
                });
             } else {
                toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: 'Could not fetch sales records.',
                });
            }
            setLoading(false);
        });

        return unsubscribe; // Return the unsubscribe function to be called on cleanup
    };
    
    useEffect(() => {
        if(userProfile) {
            const unsubscribe = fetchSales(viewMode);
            return () => unsubscribe?.();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userProfile, date, viewMode]);


    const handleReturn = async (saleId: string, itemIndex: number, productId: string, quantity: number) => {
        if (!userProfile) return;
        const returnIdentifier = `${saleId}-${itemIndex}`;
        setIsReturning(returnIdentifier);
        
        try {
            await runTransaction(db, async (transaction) => {
                const saleRef = doc(db, 'sales', saleId);
                const productRef = doc(db, 'products', productId);
    
                const saleDoc = await transaction.get(saleRef);
                const productDoc = await transaction.get(productRef);
    
                if (!saleDoc.exists()) {
                    throw new Error("Sale not found.");
                }
                 if (!productDoc.exists()) {
                    console.warn(`Product with ID ${productId} not found for stock update. Only marking as returned.`);
                }
    
                const saleData = saleDoc.data() as Sale;
                const newItems = [...saleData.items];
    
                if (newItems[itemIndex].returned) {
                    throw new Error("Item already returned.");
                }
    
                newItems[itemIndex] = {
                    ...newItems[itemIndex],
                    returned: true,
                    returnedAt: Timestamp.now(),
                    returnedBy: userProfile.email || userProfile.uid,
                    returnedByRole: userProfile.role,
                };
    
                transaction.update(saleRef, { items: newItems });
    
                if (productDoc.exists()) {
                    const newQuantity = (productDoc.data().quantity || 0) + quantity;
                    transaction.update(productRef, { quantity: newQuantity });
                }
            });

            toast({ title: 'Return successful', description: 'Stock has been updated.' });
            // No need to call fetchSales here, onSnapshot will do it.
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Return Error', description: error.message || 'Could not process the return.' });
        } finally {
            setIsReturning(null);
        }
    }

    const handleEdit = (sale: EnrichedSale, item: EnrichedSaleItem) => {
        setSelectedSaleItem({ sale, item });
        setIsEditModalOpen(true);
    };

    const handleItemUpdate = async (saleId: string, itemIndex: number, updatedPrices: { purchasePrice: number, sellingPrice: number }) => {
        try {
            const saleRef = doc(db, 'sales', saleId);
            
            await runTransaction(db, async (transaction) => {
                const saleDoc = await transaction.get(saleRef);
                if (!saleDoc.exists()) {
                    throw new Error("Sale not found.");
                }

                const saleData = saleDoc.data() as Sale;
                const newItems = [...saleData.items];
                
                if(newItems[itemIndex]) {
                    newItems[itemIndex].purchasePrice = updatedPrices.purchasePrice;
                    newItems[itemIndex].sellingPrice = updatedPrices.sellingPrice;
                } else {
                    throw new Error("Item index out of bounds.");
                }
                
                transaction.update(saleRef, { items: newItems });
            });
            
            toast({ title: 'Success', description: 'Sale item updated successfully.' });
            setIsEditModalOpen(false);
            setSelectedSaleItem(null);
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Update Error', description: error.message || 'Could not update the sale item.' });
        }
    };
    
    const sortedDateKeys = useMemo(() => {
      return Object.keys(salesByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    }, [salesByDate]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center gap-4">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn("w-full sm:w-[300px] justify-start text-left font-normal", !date && "text-muted-foreground")}
                            disabled={viewMode === 'all'}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date ? format(date, "PPP") : (
                                <span>Pick a date</span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            initialFocus
                            mode="single"
                            selected={date}
                            onSelect={(d) => { setDate(d); setViewMode('single'); }}
                            disabled={(d) => d > new Date() || d < new Date("1900-01-01")}
                        />
                    </PopoverContent>
                </Popover>
                
                <Button onClick={() => setViewMode('all')} disabled={loading || viewMode === 'all'} className="w-full sm:w-auto" variant="secondary">
                     {loading && viewMode === 'all' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    All Sales
                </Button>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="space-y-8">
                    {sortedDateKeys.length === 0 && !loading && (
                        <Card>
                            <CardContent className="py-8 text-center text-muted-foreground">
                                <p>No sales records found for the selected criteria.</p>
                            </CardContent>
                        </Card>
                    )}
                    {sortedDateKeys.map(dateKey => {
                        const sales = salesByDate[dateKey];
                         if (!sales) return null;

                        const totals = sales.reduce((acc, sale) => {
                            sale.items.forEach(item => {
                                if (!item.returned) {
                                    acc.revenue += item.sellingPrice * item.quantity;
                                    acc.profit += item.profit;
                                    acc.totalItems += item.quantity;
                                }
                            });
                            return acc;
                        }, { revenue: 0, profit: 0, totalItems: 0 });

                        return (
                            <Card key={dateKey}>
                                <CardHeader>
                                    <CardTitle>Sales for {format(new Date(dateKey), 'PPP')}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                        <Card>
                                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Items Sold</CardTitle></CardHeader>
                                            <CardContent><p className="text-2xl font-bold">{totals.totalItems}</p></CardContent>
                                        </Card>
                                        <Card>
                                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Revenue</CardTitle></CardHeader>
                                            <CardContent><p className="text-2xl font-bold">{totals.revenue.toFixed(2)}</p></CardContent>
                                        </Card>
                                        {isAdmin && (
                                            <Card>
                                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Profit</CardTitle></CardHeader>
                                                <CardContent><p className="text-2xl font-bold text-green-600">{totals.profit.toFixed(2)}</p></CardContent>
                                            </Card>
                                        )}
                                    </div>
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-lg">Sales Details</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                           <div className="overflow-x-auto">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Time</TableHead>
                                                            <TableHead>Sold By</TableHead>
                                                            <TableHead>Product</TableHead>
                                                            <TableHead>Qty</TableHead>
                                                            {isAdmin && <TableHead className="text-right">Buying Price</TableHead>}
                                                            <TableHead className="text-right">Selling Price</TableHead>
                                                            <TableHead className="text-right">Total Amount</TableHead>
                                                            {isAdmin && <TableHead className="text-right">Profit</TableHead>}
                                                            <TableHead className="text-right">Actions</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {sales.length === 0 ? (
                                                            <TableRow>
                                                                <TableCell colSpan={isAdmin ? 9 : 7} className="text-center py-8 text-muted-foreground">
                                                                    No sales recorded on this date.
                                                                </TableCell>
                                                            </TableRow>
                                                        ) : (
                                                            sales.flatMap(sale => 
                                                                sale.items.map((item, index) => (
                                                                    <TableRow key={`${sale.id}-${item.productId}-${index}`} className={cn(item.returned && "bg-muted/50")}>
                                                                        <TableCell className={cn(item.returned && "line-through")}>{format(sale.createdAt.toDate(), 'p')}</TableCell>
                                                                        <TableCell className={cn("capitalize", item.returned && "line-through")}>
                                                                            <Badge variant="outline">{sale.createdByRole}</Badge>
                                                                        </TableCell>
                                                                        <TableCell className={cn("min-w-[150px]", item.returned && "line-through")}>{item.name}</TableCell>
                                                                        <TableCell className={cn(item.returned && "line-through")}>{item.quantity}</TableCell>
                                                                        {isAdmin && <TableCell className={cn("text-right", item.returned && "line-through")}>{(item.purchasePrice ?? 0).toFixed(2)}</TableCell>}
                                                                        <TableCell className={cn("text-right", item.returned && "line-through")}>{item.sellingPrice.toFixed(2)}</TableCell>
                                                                        <TableCell className={cn("text-right", item.returned && "line-through")}>{(item.sellingPrice * item.quantity).toFixed(2)}</TableCell>
                                                                        {isAdmin && <TableCell className={cn("text-right text-green-600", item.returned && "line-through text-red-600")}>{item.profit.toFixed(2)}</TableCell>}
                                                                        <TableCell className="text-right">
                                                                            <div className="flex justify-end items-center">
                                                                                {item.returned ? (
                                                                                    <Badge className={cn(
                                                                                        "text-white",
                                                                                        item.returnedByRole === 'admin' ? 'bg-green-600 hover:bg-green-700' : 'bg-destructive hover:bg-destructive/90'
                                                                                    )}>Returned</Badge>
                                                                                ) : (
                                                                                    <>
                                                                                    {isAdmin &&
                                                                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(sale, item)}>
                                                                                                <Edit className="h-4 w-4" />
                                                                                            </Button>
                                                                                        }
                                                                                    <AlertDialog>
                                                                                        <AlertDialogTrigger asChild>
                                                                                            <Button variant="ghost" size="icon" disabled={isReturning === `${item.saleId}-${item.itemIndex}`}>
                                                                                                {isReturning === `${item.saleId}-${item.itemIndex}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                                                                                            </Button>
                                                                                        </AlertDialogTrigger>
                                                                                        <AlertDialogContent>
                                                                                            <AlertDialogHeader>
                                                                                                <AlertDialogTitle>Return Item?</AlertDialogTitle>
                                                                                                <AlertDialogDescription>
                                                                                                    Are you sure you want to mark this item as returned? This will add {item.quantity} back to the stock for {item.name}. This action cannot be undone.
                                                                                                </AlertDialogDescription>
                                                                                            </AlertDialogHeader>
                                                                                            <AlertDialogFooter>
                                                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                                                <AlertDialogAction onClick={() => handleReturn(item.saleId, item.itemIndex, item.productId, item.quantity)}>
                                                                                                    Confirm Return
                                                                                                </AlertDialogAction>
                                                                                            </AlertDialogFooter>
                                                                                        </AlertDialogContent>
                                                                                    </AlertDialog>
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))
                                                            )
                                                        )}
                                                    </TableBody>
                                                </Table>
                                           </div>
                                        </CardContent>
                                    </Card>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}
             {selectedSaleItem && (
                <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit Sale Item: {selectedSaleItem.item.name}</DialogTitle>
                        </DialogHeader>
                        <SaleItemEditForm
                            saleItem={selectedSaleItem.item}
                            onUpdate={(updatedPrices) => handleItemUpdate(selectedSaleItem.sale.id, selectedSaleItem.item.itemIndex, updatedPrices)}
                            onCancel={() => setIsEditModalOpen(false)}
                        />
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
