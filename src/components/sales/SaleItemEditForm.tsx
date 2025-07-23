
"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import type { SaleItem } from '@/types';
import { DialogFooter } from '../ui/dialog';

const formSchema = z.object({
  purchasePrice: z.coerce.number().min(0, "Purchase price cannot be negative."),
  sellingPrice: z.coerce.number().positive("Selling price must be positive."),
});

type FormValues = z.infer<typeof formSchema>;

interface SaleItemEditFormProps {
  saleItem: SaleItem;
  onUpdate: (updatedPrices: { purchasePrice: number, sellingPrice: number }) => void;
  onCancel: () => void;
}

export function SaleItemEditForm({ saleItem, onUpdate, onCancel }: SaleItemEditFormProps) {
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      purchasePrice: saleItem.purchasePrice || 0,
      sellingPrice: saleItem.sellingPrice,
    },
  });

  const handleSubmit = (values: FormValues) => {
    onUpdate(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
        <FormField
          control={form.control}
          name="sellingPrice"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Selling Price</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit">Save Changes</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
