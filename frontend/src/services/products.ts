
import { api } from "../lib/api";
import type { Product } from "../types/product";

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export async function getProducts(): Promise<Product[]> {
  const response = await api.get<
    Product[] | PaginatedResponse<Product>
  >("/products/");

  const data = response.data;

  // Support both paginated and non-paginated Django responses.
  return Array.isArray(data) ? data : data.results;
}

export function getProductImage(
  image: string | null | undefined
): string | null {
  if (!image) {
    return null;
  }

  // Keep absolute image URLs unchanged.
  if (/^https?:\/\//i.test(image)) {
    return image;
  }

  // Use the Django backend origin for relative media paths.
  const backendOrigin = "http://127.0.0.1:8000";
  const normalizedPath = image.startsWith("/")
    ? image
    : `/${image}`;

  return `${backendOrigin}${normalizedPath}`;
}
