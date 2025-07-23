
"use client";

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ScanLine } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { BarcodeScanner } from '../billing/BarcodeScanner';
import type { Product } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { recalculateProfitForProduct } from '@/services/recalculateProfit';


// Schema for admins
const adminFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  barcode: z.string().optional(),
  purchasePrice: z.coerce.number().min(0, "Purchase price cannot be negative."),
  sellingPrice: z.coerce.number().positive("Selling price must be positive."),
  quantity: z.coerce.number().int().min(0, "Quantity cannot be negative."),
});

// Schema for shopkeepers
const shopkeeperFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  barcode: z.string().optional(),
  sellingPrice: z.coerce.number().min(0, "Selling price can't be negative.").optional(),
  quantity: z.coerce.number().int().min(0, "Quantity cannot be negative."),
});


type ProductFormValues = z.infer<typeof adminFormSchema>;

interface ProductFormProps {
  onProductAdded?: () => void;
  onProductUpdated?: () => void;
  productToEdit?: Product | null;
  isEditMode?: boolean;
}

export function ProductForm({ onProductAdded, onProductUpdated, productToEdit, isEditMode = false }: ProductFormProps) {
  const [loading, setLoading] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin';
  const videoRef = useRef<HTMLVideoElement>(null);


  const form = useForm<ProductFormValues>({
    resolver: zodResolver(isAdmin ? adminFormSchema : shopkeeperFormSchema),
    defaultValues: {
      name: "",
      barcode: "",
      purchasePrice: 0,
      sellingPrice: 0,
      quantity: 0,
    },
  });

  useEffect(() => {
    if (isEditMode && productToEdit) {
      form.reset({
        name: productToEdit.name,
        barcode: productToEdit.barcode,
        purchasePrice: productToEdit.purchasePrice,
        sellingPrice: productToEdit.sellingPrice,
        quantity: productToEdit.quantity,
      });
    } else {
      form.reset({
        name: "",
        barcode: "",
        purchasePrice: 0,
        sellingPrice: 0,
        quantity: 0,
      });
    }
  }, [productToEdit, isEditMode, form]);

  const handleBarcodeScanned = (barcode: string) => {
    form.setValue('barcode', barcode);
    setIsScannerOpen(false);
    toast({ title: "Barcode Scanned", description: barcode });
  };

  async function onSubmit(values: ProductFormValues) {
    setLoading(true);
    try {
      if (isEditMode && productToEdit) {
        const productRef = doc(db, 'products', productToEdit.id);
        const oldPurchasePrice = productToEdit.purchasePrice;
        const newPurchasePrice = values.purchasePrice;

        const updateData: any = {
            name: values.name,
            barcode: values.barcode || '',
            sellingPrice: values.sellingPrice,
            quantity: values.quantity,
        };
        if (isAdmin) {
            updateData.purchasePrice = newPurchasePrice;
        }

        await setDoc(productRef, updateData , { merge: true });
        
        toast({ title: "Success", description: "Product updated successfully." });
        onProductUpdated?.();

        // If purchase price changed, trigger recalculation
        if (isAdmin && oldPurchasePrice !== newPurchasePrice) {
            toast({ title: "Recalculating Profit", description: "Updating historical sales data. This may take a moment." });
            try {
                await recalculateProfitForProduct(productToEdit.id, newPurchasePrice);
                toast({ title: "Recalculation Complete", description: "Profit reports are now up-to-date." });
            } catch (recalcError) {
                console.error("Profit recalculation failed:", recalcError);
                toast({ variant: 'destructive', title: 'Recalculation Error', description: 'Could not update historical profit data.' });
            }
        }
      } else {
        await addDoc(collection(db, 'products'), {
          name: values.name,
          barcode: values.barcode || '',
          sellingPrice: values.sellingPrice || 0,
          quantity: values.quantity,
          purchasePrice: isAdmin ? values.purchasePrice : 0,
          createdAt: serverTimestamp(),
        });
        toast({ title: "Success", description: "Product added successfully." });
        form.reset();
        onProductAdded?.();
      }
    } catch (error) {
      console.error(error);
      const action = isEditMode ? 'update' : 'add';
      toast({ variant: 'destructive', title: 'Error', description: `Could not ${action} product.` });
    } finally {
      setLoading(false);
    }
  }

  const formContent = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Product Name</FormLabel>
              <FormControl>
                <Input placeholder="E.g., Lipstick" {...field} />
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
              <FormLabel>Barcode (Optional)</FormLabel>
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
                        {isScannerOpen && (
                          <div>
                            <video ref={videoRef} className="w-full aspect-video rounded-md bg-black" autoPlay muted playsInline />
                            <BarcodeScanner onScan={handleBarcodeScanned} videoRef={videoRef} />
                          </div>
                        )}
                    </DialogContent>
                </Dialog>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className={`grid ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
            {isAdmin && (
                <FormField
                  control={form.control}
                  name="purchasePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Price</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            )}
            <FormField
              control={form.control}
              name="sellingPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Selling Price</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} placeholder={!isAdmin ? "Leave blank to set later" : "0.00"} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
        </div>
         <FormField
          control={form.control}
          name="quantity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Stock Quantity</FormLabel>
              <FormControl>
                <Input type="number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {!isEditMode && (
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Product
          </Button>
        )}
      </form>
    </Form>
  );

  if (isEditMode) {
    return (
      <>
        {formContent}
        <DialogFooter className="pt-4">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={form.handleSubmit(onSubmit)} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </>
    );
  }

  return <div className="max-w-lg">{formContent}</div>;
}
