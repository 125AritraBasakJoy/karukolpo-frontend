export interface ProductImage {
  id: string;
  product_id: string;
  image_path: string;
  image_thumb?: string;
  image_medium?: string;
  image_large?: string;
  is_primary: boolean;
  order?: number;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  description: string;
  price: number;
  cost?: number;
  imageUrl: string;
  images?: string[];
  imageObjects?: ProductImage[];
  stock?: number;
  manualStockStatus?: 'IN_STOCK' | 'OUT_OF_STOCK' | 'AUTO';
  categoryId?: string;
  categories?: any[];
  isInStock?: boolean;
  isHotDeal?: boolean;
  isBestSeller?: boolean;
  discount_type?: string | null;
  discount_value?: number | null;
  discount_starts_at?: Date | string | null;
  discount_ends_at?: Date | string | null;
  effective_price?: number;
}
