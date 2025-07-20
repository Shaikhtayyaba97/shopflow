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
  createdAt: Timestamp;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface SaleItem {
    productId: string;
    quantity: number;
    purchasePrice: number;
    sellingPrice: number;
    name: string;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  totalAmount: number;
  createdBy: string;
  createdAt: Timestamp;
}
