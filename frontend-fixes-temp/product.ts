export type ProductCategory = "candy" | "yoghurt" | "ice_pop";

export interface Product {
  id: number;
  name: string;
  category: ProductCategory;
  description: string;
  price: string | number;
  image: string | null;
  stock_quantity: number;
  is_available: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CheckoutResponse {
  order_number: string;
  status: string;
  total: string | number;
}