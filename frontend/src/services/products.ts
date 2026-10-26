
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

  return Array.isArray(data) ? data : data.results;
}

export function getProductImage(
  image: string | null | undefined,
): string | null {
  if (!image) {
    return null;
  }

  if (/^https?:\/\//i.test(image)) {
    return image;
  }

  const normalizedPath = image.startsWith("/")
    ? image
    : `/${image}`;

  const apiBaseUrl = (
    import.meta.env.VITE_API_BASE_URL as string | undefined
  )?.trim() || "/api";

  let backendOrigin = "";

  if (/^https?:\/\//i.test(apiBaseUrl)) {
    try {
      backendOrigin = new URL(apiBaseUrl).origin;
    } catch {
      backendOrigin = "";
    }
  }

  return `${backendOrigin}${normalizedPath}`;
}
