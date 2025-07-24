
'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, Printer, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import type { Sale } from '@/types';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';


export default function PrintReceiptPage() {
    const { saleId } = useParams();
    const [sale, setSale] = useState<Sale | null>(null);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        if (typeof saleId === 'string') {
            const fetchSale = async () => {
                setLoading(true);
                try {
                    const saleDocRef = doc(db, 'sales', saleId);
                    const saleDoc = await getDoc(saleDocRef);
                    if (saleDoc.exists()) {
                        setSale({ id: saleDoc.id, ...saleDoc.data() } as Sale);
                    } else {
                        toast({ variant: 'destructive', title: 'Error', description: 'Sale not found.' });
                    }
                } catch (error) {
                    console.error("Error fetching sale for printing:", error);
                    toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch sale details.' });
                } finally {
                    setLoading(false);
                }
            };
            fetchSale();
        }
    }, [saleId, toast]);
    
    useEffect(() => {
      if (sale) {
        // Automatically trigger print dialog when sale data is loaded
        handlePrint();
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sale])

    const handlePrint = () => {
        setTimeout(() => window.print(), 500); // Small delay to ensure content is rendered
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (!sale) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="bg-white p-4 rounded shadow-md text-center">
                    <p>Sale not found.</p>
                    <Button onClick={() => router.back()} className="mt-4 no-print">Go Back</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center py-8">
            <div className="w-[58mm] bg-white p-2 printable-area">
                <div className="text-center">
                    <h1 className="font-bold text-sm">ShopFlow</h1>
                    <p>Your friendly neighborhood store.</p>
                    <p>Date: {format(sale.createdAt.toDate(), 'dd/MM/yyyy p')}</p>
                    <p>Receipt #: {sale.id.slice(0, 6)}</p>
                </div>

                <Separator className="border-dashed border-black my-1" />

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sale.items.map((item, index) => (
                            <TableRow key={index} className={item.returned ? 'line-through' : ''}>
                                <TableCell>{item.name}</TableCell>
                                <TableCell className="text-right">{item.quantity}</TableCell>
                                <TableCell className="text-right">
                                    {(item.sellingPrice * item.quantity).toFixed(2)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                <Separator className="border-dashed border-black my-1" />

                <div className="flex justify-between font-bold">
                    <span>Total</span>
                    <span>{sale.totalAmount.toFixed(2)}</span>
                </div>
                 <div className="text-center mt-2">
                    <p>Thank you for your purchase!</p>
                </div>
            </div>

            <div className="no-print mt-6 flex gap-4">
                 <Button variant="outline" onClick={() => router.push('/dashboard/billing')}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Billing
                </Button>
                <Button onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print Receipt
                </Button>
            </div>
        </div>
    );
}
