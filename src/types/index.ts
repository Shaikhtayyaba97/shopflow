
import type { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string | null;
  role: 'admin' | 'shopkeeper';
}

export interface Product {
  id: string;
  name: string;
  barcode: string;
  purchasePrice: number;
  sellingPrice: number;
  quantity: number;
  createdAt: Timestamp;
}

export interface CartItem extends Product {
  quantityInCart: number;
}

export interface SaleItem {
    productId: string;
    quantity: number;
    purchasePrice: number;
    sellingPrice: number;
    name: string;
    returned?: boolean;
    returnedBy?: string;
    returnedAt?: Timestamp;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  totalAmount: number;
  createdBy: string;
  createdByName: string | null;
  createdByRole: 'admin' | 'shopkeeper';
  createdAt: Timestamp;
}
