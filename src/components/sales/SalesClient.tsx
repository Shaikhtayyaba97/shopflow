
"use client"

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp, orderBy, QueryConstraint, runTransaction, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Sale, SaleItem } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { DateRange } from 'react-day-picker';
import { format, startOfDay, endOfDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon, Loader2, Undo2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

interface EnrichedSaleItem extends SaleItem {
  profit: number;
  saleId: string;
  itemIndex: number;
}

interface EnrichedSale extends Omit<Sale, 'items'> {
  items: EnrichedSaleItem[];
  totalProfit: number;
}

export function SalesClient() {
    const [date, setDate] = useState<DateRange | undefined>({
        from: new Date(),
        to: new Date(),
    });
    const [sales, setSales] = useState<EnrichedSale[]>([]);
    const [loading, setLoading] = useState(false);
    const [isReturning, setIsReturning] = useState<string | null>(null);
    const { userProfile } = useAuth();
    const { toast } = useToast();
    const isAdmin = userProfile?.role === 'admin';

    const fetchSales = async () => {
        if (!date?.from || !userProfile) return;
        setLoading(true);

        const toDate = date.to ?? date.from;

        try {
            const constraints: QueryConstraint[] = [
                where('createdAt', '>=', Timestamp.fromDate(startOfDay(date.from))),
                where('createdAt', '<=', Timestamp.fromDate(endOfDay(toDate))),
                orderBy('createdAt', 'desc')
            ];

            const q = query(collection(db, 'sales'), ...constraints);
            const querySnapshot = await getDocs(q);
            const salesData = querySnapshot.docs.map(docSnapshot => {
                const sale = { id: docSnapshot.id, ...docSnapshot.data() } as Sale;
                let totalProfit = 0;
                
                const enrichedItems = sale.items.map((item, index) => {
                    const profit = (item.sellingPrice - (item.purchasePrice || 0)) * item.quantity;
                    if (!item.returned) {
                        totalProfit += profit;
                    }
                    return { ...item, profit, saleId: sale.id, itemIndex: index };
                });
                
                return { ...sale, items: enrichedItems, totalProfit };
            });
            setSales(salesData);
        } catch (error: any) {
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
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => {
        if(userProfile) {
            fetchSales();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userProfile]);

    const handleReturn = async (saleId: string, itemIndex: number, productId: string, quantity: number) => {
        if (!userProfile) return;
        const returnIdentifier = `${saleId}-${itemIndex}`;
        setIsReturning(returnIdentifier);
        
        try {
            await runTransaction(db, async (transaction) => {
                const saleRef = doc(db, 'sales', saleId);
                const productRef = doc(db, 'products', productId);

                const saleDoc = await transaction.get(saleRef);
                if (!saleDoc.exists()) throw new Error("Sale not found.");
                
                const saleData = saleDoc.data() as Sale;
                const newItems = [...saleData.items];
                
                if (newItems[itemIndex].returned) {
                    throw new Error("Item already returned.");
                }

                newItems[itemIndex] = {
                    ...newItems[itemIndex],
                    returned: true,
                    returnedAt: Timestamp.fromDate(new Date()),
                    returnedBy: userProfile.email || userProfile.uid
                };
                
                transaction.update(saleRef, { items: newItems });
                
                const productDoc = await transaction.get(productRef);
                if (productDoc.exists()) {
                    const newQuantity = (productDoc.data().quantity || 0) + quantity;
                    transaction.update(productRef, { quantity: newQuantity });
                }
            });

            toast({ title: 'Return successful', description: 'Stock has been updated.' });
            fetchSales(); // Refresh the sales data
        } catch (error: any) {
            console.error("Error processing return:", error);
            toast({ variant: 'destructive', title: 'Return Error', description: error.message || 'Could not process the return.' });
        } finally {
            setIsReturning(null);
        }
    }

    const totals = sales.reduce((acc, sale) => {
        sale.items.forEach(item => {
            if (!item.returned) {
                acc.revenue += item.sellingPrice * item.quantity;
                acc.profit += item.profit;
            }
        });
        return acc;
    }, { revenue: 0, profit: 0 });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center gap-4">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn("w-full sm:w-[300px] justify-start text-left font-normal", !date && "text-muted-foreground")}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date?.from ? (
                                date.to ? (
                                    <>{format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}</>
                                ) : (
                                    format(date.from, "LLL dd, y")
                                )
                            ) : (
                                <span>Pick a date range</span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={date?.from}
                            selected={date}
                            onSelect={setDate}
                            numberOfMonths={2}
                        />
                    </PopoverContent>
                </Popover>
                <Button onClick={fetchSales} disabled={loading} className="w-full sm:w-auto">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Generate Report
                </Button>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <>
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                            <CardHeader><CardTitle>Total Revenue</CardTitle></CardHeader>
                            <CardContent><p className="text-2xl font-bold">{totals.revenue.toFixed(2)}</p></CardContent>
                        </Card>
                        {isAdmin && (
                            <Card>
                                <CardHeader><CardTitle>Total Profit</CardTitle></CardHeader>
                                <CardContent><p className="text-2xl font-bold text-green-600">{totals.profit.toFixed(2)}</p></CardContent>
                            </Card>
                        )}
                    </div>
                    
                    <Card>
                        <CardHeader><CardTitle>Sales Details</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
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
                                                No sales recorded for the selected period.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        sales.flatMap(sale => 
                                            sale.items.map((item, index) => (
                                                <TableRow key={`${sale.id}-${item.productId}-${index}`} className={cn(item.returned && "bg-muted/50")}>
                                                    <TableCell className={cn(item.returned && "line-through")}>{index === 0 ? format(sale.createdAt.toDate(), 'PP p') : ''}</TableCell>
                                                    <TableCell className={cn(item.returned && "line-through")}>
                                                      {index === 0 ? (
                                                        <div>
                                                          <p>{sale.createdByName?.split('@')[0]}</p>
                                                          <Badge variant="outline">{sale.createdByRole}</Badge>
                                                        </div>
                                                      ) : ''}
                                                    </TableCell>
                                                    <TableCell className={cn(item.returned && "line-through")}>{item.name}</TableCell>
                                                    <TableCell className={cn(item.returned && "line-through")}>{item.quantity}</TableCell>
                                                    {isAdmin && <TableCell className={cn("text-right", item.returned && "line-through")}>{item.purchasePrice.toFixed(2)}</TableCell>}
                                                    <TableCell className={cn("text-right", item.returned && "line-through")}>{item.sellingPrice.toFixed(2)}</TableCell>
                                                    <TableCell className={cn("text-right", item.returned && "line-through")}>{(item.sellingPrice * item.quantity).toFixed(2)}</TableCell>
                                                    {isAdmin && <TableCell className={cn("text-right text-green-600", item.returned && "line-through text-red-600")}>{item.profit.toFixed(2)}</TableCell>}
                                                    <TableCell className="text-right">
                                                        {item.returned ? (
                                                            <Badge variant="destructive">Returned</Badge>
                                                        ) : (
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
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
