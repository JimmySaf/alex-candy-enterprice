
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
  const value = image?.trim();

  if (!value) {
    return null;
  }

  // Absolute URLs from cloud storage should be used unchanged.
  if (/^https?:\\/\\//i.test(value)) {
    try {
      const parsed = new URL(value);

      // Product records created during local development may contain localhost URLs.
      // Keep their path, but resolve it against the currently deployed site instead.
      if (
        parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "0.0.0.0"
      ) {
        return `${window.location.origin}${parsed.pathname}${parsed.search}`;
      }

      return value;
    } catch {
      return value;
    }
  }

  // Protocol-relative cloud URLs.
  if (value.startsWith("//")) {
    return `${window.location.protocol}${value}`;
  }

  // Django ImageField values are commonly returned as /media/products/name.jpg
  // or media/products/name.jpg. Resolve them on the current website by default.
  const normalizedPath = value.startsWith("/") ? value : `/${value}`;

  // If the API is hosted on a separate absolute origin, use that origin for media.
  const apiBaseUrl = (
    import.meta.env.VITE_API_BASE_URL as string | undefined
  )?.trim() || "/api";

  if (/^https?:\\/\\//i.test(apiBaseUrl)) {
    try {
      return `${new URL(apiBaseUrl).origin}${normalizedPath}`;
    } catch {
      // Fall through to the current website origin.
    }
  }

  return normalizedPath;
}
