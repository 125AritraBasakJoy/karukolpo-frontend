export interface Product {
  id: string;
  code: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  images?: string[];
  stock?: number;
  manualStockStatus?: 'IN_STOCK' | 'OUT_OF_STOCK' | 'AUTO';
  categoryId?: string;
  categories?: any[];
  isInStock?: boolean;
}
