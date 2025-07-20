"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ScanLine } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { BarcodeScanner } from '../billing/BarcodeScanner';

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  barcode: z.string().min(1, "Barcode is required."),
  purchasePrice: z.coerce.number().positive("Purchase price must be positive."),
  sellingPrice: z.coerce.number().positive("Selling price must be positive."),
});

export function ProductForm({ onProductAdded }: { onProductAdded?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      barcode: "",
      purchasePrice: 0,
      sellingPrice: 0,
    },
  });

  const handleBarcodeScanned = (barcode: string) => {
    form.setValue('barcode', barcode);
    setIsScannerOpen(false);
    toast({ title: "Barcode Scanned", description: barcode });
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    try {
      await addDoc(collection(db, 'products'), {
        ...values,
        createdAt: serverTimestamp(),
      });
      toast({ title: "Success", description: "Product added successfully." });
      form.reset();
      onProductAdded?.();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not add product.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Product Name</FormLabel>
              <FormControl>
                <Input placeholder="E.g., T-Shirt" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="barcode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Barcode</FormLabel>
              <div className="flex gap-2">
                <FormControl>
                  <Input placeholder="Scan or enter barcode" {...field} />
                </FormControl>
                <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="icon" type="button">
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
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="purchasePrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purchase Price ($)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sellingPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Selling Price ($)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
        </div>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Add Product
        </Button>
      </form>
    </Form>
  );
}
