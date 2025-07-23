
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import type { Sale } from '@/types';

/**
 * Finds all past sales for a given product and updates the purchasePrice for each sale item.
 * This is used to retroactively calculate profit when an admin updates a product's cost.
 * @param productId The ID of the product that was updated.
 * @param newPurchasePrice The new purchase price to set on all historical sales.
 */
export async function recalculateProfitForProduct(productId: string, newPurchasePrice: number): Promise<void> {
  console.log(`Starting profit recalculation for product ${productId} with new price ${newPurchasePrice}`);
  
  // 1. Find all sales containing the product
  const salesQuery = query(collection(db, 'sales'), where('items', 'array-contains-any', [{ productId: productId }]));
  const salesSnapshot = await getDocs(salesQuery);

  if (salesSnapshot.empty) {
    console.log(`No sales found for product ${productId}. No recalculation needed.`);
    return;
  }

  // 2. Create a batch to update all documents efficiently
  const batch = writeBatch(db);
  let updatedSalesCount = 0;

  salesSnapshot.forEach(docSnapshot => {
    const sale = { id: docSnapshot.id, ...docSnapshot.data() } as Sale;
    let needsUpdate = false;

    // Create a new items array with the updated purchase price
    const updatedItems = sale.items.map(item => {
      // Check if this is the correct product and if the price is different
      if (item.productId === productId && item.purchasePrice !== newPurchasePrice) {
        needsUpdate = true;
        return {
          ...item,
          purchasePrice: newPurchasePrice,
        };
      }
      return item;
    });

    // 3. If an update is needed, add the update operation to the batch
    if (needsUpdate) {
      const saleRef = doc(db, 'sales', sale.id);
      batch.update(saleRef, { items: updatedItems });
      updatedSalesCount++;
    }
  });

  // 4. Commit the batch if there are updates to be made
  if (updatedSalesCount > 0) {
    await batch.commit();
    console.log(`Successfully updated purchasePrice for ${productId} in ${updatedSalesCount} sales records.`);
  } else {
    console.log(`All historical sales for product ${productId} already had the correct purchase price. No updates were necessary.`);
  }
}
