"use client"

import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Sale } from '@/types';
import { DateRange } from 'react-day-picker';
import { format, startOfMonth } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';


export function ProfitReportClient() {
    const [date, setDate] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: new Date(),
    });
    const [sales, setSales] = useState<Sale[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchSales = async () => {
        if (!date?.from || !date?.to) return;
        setLoading(true);

        try {
            const q = query(
                collection(db, 'sales'),
                where('createdAt', '>=', Timestamp.fromDate(date.from)),
                where('createdAt', '<=', Timestamp.fromDate(date.to)),
                orderBy('createdAt', 'asc')
            );
            const querySnapshot = await getDocs(q);
            const salesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Sale);
            setSales(salesData);
        } catch (error) {
            console.error("Error fetching sales:", error);
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => {
        fetchSales();
    }, []);

    const { totalProfit, totalRevenue, chartData } = useMemo(() => {
        let profit = 0;
        let revenue = 0;
        
        const dailyData = sales.reduce((acc, sale) => {
            const dateKey = format(sale.createdAt.toDate(), 'MMM d');
            if (!acc[dateKey]) {
                acc[dateKey] = { date: dateKey, revenue: 0, profit: 0 };
            }
            const saleProfit = sale.items.reduce((itemProfit, item) => itemProfit + (item.sellingPrice - item.purchasePrice) * item.quantity, 0);
            
            acc[dateKey].revenue += sale.totalAmount;
            acc[dateKey].profit += saleProfit;
            
            revenue += sale.totalAmount;
            profit += saleProfit;
            
            return acc;
        }, {} as Record<string, { date: string, revenue: number, profit: number }>);

        return {
            totalProfit: profit,
            totalRevenue: revenue,
            chartData: Object.values(dailyData),
        }
    }, [sales]);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn("w-[300px] justify-start text-left font-normal", !date && "text-muted-foreground")}
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
                <Button onClick={fetchSales} disabled={loading}>
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
                            <CardHeader><CardTitle>Total Revenue</CardTitle><CardDescription>Total sales in the selected period.</CardDescription></CardHeader>
                            <CardContent><p className="text-2xl font-bold">${totalRevenue.toFixed(2)}</p></CardContent>
                        </Card>
                        <Card>
                            <CardHeader><CardTitle>Total Profit</CardTitle><CardDescription>Net profit in the selected period.</CardDescription></CardHeader>
                            <CardContent><p className="text-2xl font-bold text-green-600">${totalProfit.toFixed(2)}</p></CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Daily Performance</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[350px]">
                            {chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData}>
                                        <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                                        <Tooltip
                                          contentStyle={{
                                            backgroundColor: 'hsl(var(--card))',
                                            borderColor: 'hsl(var(--border))',
                                            borderRadius: 'var(--radius)'
                                          }}
                                          cursor={{fill: 'hsl(var(--muted))'}}
                                        />
                                        <Legend wrapperStyle={{fontSize: "14px"}} />
                                        <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="profit" name="Profit" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                    No sales data for the selected period.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
