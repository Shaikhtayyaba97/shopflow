
'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, Printer, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import type { Sale } from '@/types';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Minimal layout for the print page
const PrintLayout = ({ children }: { children: React.ReactNode }) => (
    <>
      <style jsx global>{`
        @page {
          size: 58mm auto;
          margin: 0;
        }
        @media print {
          body {
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
          .printable-area {
            font-size: 8pt;
            color: black;
            width: 100%;
          }
           .printable-area table,
           .printable-area th,
           .printable-area td {
            padding: 1mm 0;
            border: none;
            text-align: left;
            color: black !important;
          }
           .printable-area .text-right {
             text-align: right;
           }
           .printable-area h1, .printable-area h2, .printable-area h3, .printable-area p, .printable-area div, .printable-area span, .printable-area button {
            margin: 0;
            padding: 0;
            color: black !important;
           }
        }
      `}</style>
      <div className="min-h-screen bg-gray-100 flex flex-col items-center py-8">
        {children}
      </div>
    </>
);


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

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <PrintLayout>
                <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            </PrintLayout>
        );
    }

    if (!sale) {
        return (
            <PrintLayout>
                <div className="bg-white p-4 rounded shadow-md text-center">
                    <p>Sale not found.</p>
                    <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
                </div>
            </PrintLayout>
        );
    }

    return (
        <PrintLayout>
            <div className="w-[58mm] bg-white p-2">
                <div className="printable-area space-y-2">
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
        </PrintLayout>
    );
}
