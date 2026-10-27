
import type { Product } from "../types/product";

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || "/api";

export async function getProducts(): Promise<Product[]> {
  const response = await fetch(`${API_BASE_URL}/products/`);

  if (!response.ok) {
    throw new Error(`Failed to load products: ${response.status}`);
  }

  const data: unknown = await response.json();

  // Support APIs that return either a plain array or paginated results.
  if (Array.isArray(data)) {
    return data as Product[];
  }

  if (
    typeof data === "object" &&
    data !== null &&
    "results" in data &&
    Array.isArray(data.results)
  ) {
    return data.results as Product[];
  }

  throw new Error("The products API returned an unexpected response.");
}

export function getProductImage(
  image: string | null | undefined,
): string | null {
  const value = image?.trim();

  if (!value) {
    return null;
  }

  // Keep valid absolute URLs, except localhost URLs from local development.
  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);

      if (
        parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "0.0.0.0"
      ) {
        return `${window.location.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
      }

      return value;
    } catch {
      return value;
    }
  }

  // Resolve protocol-relative image URLs.
  if (value.startsWith("//")) {
    return `${window.location.protocol}${value}`;
  }

  const normalizedPath = value.startsWith("/") ? value : `/${value}`;

  // If the API is on a separate server, load media from that server.
  if (/^https?:\/\//i.test(API_BASE_URL)) {
    try {
      return `${new URL(API_BASE_URL).origin}${normalizedPath}`;
    } catch {
      // Fall back to the current website.
    }
  }

  return normalizedPath;
}
