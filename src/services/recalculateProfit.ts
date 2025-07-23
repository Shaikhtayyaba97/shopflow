
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import type { Sale } from '@/types';

/**
 * Finds all past sales for a given product and updates the purchasePrice and sellingPrice for each sale item.
 * This is used to retroactively calculate profit when an admin updates a product's costs.
 * @param productId The ID of the product that was updated.
 * @param newPurchasePrice The new purchase price to set on all historical sales.
 * @param newSellingPrice The new selling price to set on all historical sales.
 */
export async function recalculateProfitForProduct(productId: string, newPurchasePrice: number, newSellingPrice: number): Promise<void> {
  console.log(`Starting profit recalculation for product ${productId} with new purchase price ${newPurchasePrice} and selling price ${newSellingPrice}`);
  
  // 1. Find all sales documents that might contain the product.
  // This query is broad; we will filter precisely in the loop.
  const salesQuery = query(collection(db, 'sales'));
  const salesSnapshot = await getDocs(salesQuery);

  if (salesSnapshot.empty) {
    console.log(`No sales found. No recalculation needed.`);
    return;
  }

  const batch = writeBatch(db);
  let updatedSalesCount = 0;

  salesSnapshot.forEach(docSnapshot => {
    const sale = { id: docSnapshot.id, ...docSnapshot.data() } as Sale;
    let needsUpdate = false;

    // Filter for sales that actually contain the product and create a new items array with updated prices
    const updatedItems = sale.items.map(item => {
      if (item.productId === productId) {
        // Check if either price is different
        if (item.purchasePrice !== newPurchasePrice || item.sellingPrice !== newSellingPrice) {
          needsUpdate = true;
          return {
            ...item,
            purchasePrice: newPurchasePrice,
            sellingPrice: newSellingPrice, // Update selling price as well
          };
        }
      }
      return item;
    });

    // If an update is needed for this sale document, add the operation to the batch
    if (needsUpdate) {
      const saleRef = doc(db, 'sales', sale.id);
      batch.update(saleRef, { items: updatedItems });
      updatedSalesCount++;
    }
  });

  // Commit the batch if there are updates to be made
  if (updatedSalesCount > 0) {
    await batch.commit();
    console.log(`Successfully updated prices for ${productId} in ${updatedSalesCount} sales records.`);
  } else {
    console.log(`All historical sales for product ${productId} already had the correct prices. No updates were necessary.`);
  }
}
