
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

    const handlePrint = () => {
        const receiptContent = document.getElementById('receipt-content');
        if (receiptContent) {
            const printWindow = window.open('', '', 'height=600,width=800');
            if (printWindow) {
                printWindow.document.write('<html><head><title>Print Receipt</title>');
                // Simple styling for the print window
                printWindow.document.write(`
                    <style>
                        @page { size: 58mm; margin: 0; }
                        body { font-family: monospace; font-size: 8pt; margin: 4px; color: black; }
                        h1, p { margin: 0; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { padding: 1px 0; }
                        th { text-align: left; }
                        .text-center { text-align: center; }
                        .text-right { text-align: right; }
                        .font-bold { font-weight: bold; }
                        .text-sm { font-size: 10pt; }
                        hr { border: none; border-top: 1px dashed black; margin: 2px 0; }
                    </style>
                `);
                printWindow.document.write('</head><body>');
                printWindow.document.write(receiptContent.innerHTML);
                printWindow.document.write('</body></html>');
                printWindow.document.close();
                printWindow.focus();
                printWindow.print();
                printWindow.close();
            } else {
                toast({ variant: 'destructive', title: 'Print Error', description: 'Could not open print window. Please disable popup blockers.' });
            }
        } else {
            toast({ variant: 'destructive', title: 'Print Error', description: 'Could not find receipt content.' });
        }
    };
    

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-100">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (!sale) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-100">
                <div className="bg-white p-4 rounded shadow-md text-center">
                    <p>Sale not found.</p>
                    <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
                </div>
            </div>
        );
    }

    // This is the visible component on the page
    return (
        <div className="bg-gray-100 min-h-screen py-8">
            <div id="receipt-container" className="w-[58mm] bg-white p-2 mx-auto my-8 shadow-lg">
                <div id="receipt-content">
                    <div className="text-center text-black">
                        <h1 className="font-bold text-sm">ShopFlow</h1>
                        <p style={{fontSize: '8pt'}}>Your friendly neighborhood store.</p>
                        <p style={{fontSize: '8pt'}}>Date: {format(sale.createdAt.toDate(), 'dd/MM/yyyy p')}</p>
                        <p style={{fontSize: '8pt'}}>Receipt #: {sale.id.slice(0, 6)}</p>
                    </div>

                    <hr />
                    
                    <table style={{fontSize: '8pt', width: '100%'}}>
                        <thead>
                            <tr>
                                <th style={{textAlign: 'left'}}>Item</th>
                                <th style={{textAlign: 'center'}}>Qty</th>
                                <th style={{textAlign: 'right'}}>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sale.items.map((item, index) => (
                                <tr key={index} style={{ textDecoration: item.returned ? 'line-through' : 'none' }}>
                                    <td>{item.name}</td>
                                    <td style={{textAlign: 'center'}}>{item.quantity}</td>
                                    <td style={{textAlign: 'right'}}>
                                        {(item.sellingPrice * item.quantity).toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <hr />

                    <div style={{display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '9pt'}}>
                        <span>Total</span>
                        <span>{sale.totalAmount.toFixed(2)}</span>
                    </div>
                     <div className="text-center" style={{marginTop: '8px'}}>
                        <p style={{fontSize: '8pt'}}>Thank you for your purchase!</p>
                    </div>
                </div>
            </div>

            <div className="mt-6 flex gap-4 justify-center">
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
