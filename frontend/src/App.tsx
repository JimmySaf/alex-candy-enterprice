import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import OrderTracking from "./components/OrderTracking";
import { api } from "./lib/api";
import { getProductImage, getProducts } from "./services/products";
import type {
  CartItem,
  CheckoutResponse,
  Product,
  ProductCategory,
} from "./types/product";
import "./App.css";

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

const BUSINESS_NAME = "ALEX CANDY ENTERPRICE"; // change spelling here once
const CART_STORAGE_KEY = "alex-candy-cart-v1";
const LOW_STOCK_THRESHOLD = 5;

type CategoryFilter = "all" | ProductCategory;
type SortOption = "featured" | "price_asc" | "price_desc" | "name";

const categories: { id: CategoryFilter; label: string; emoji: string }[] = [
  { id: "all", label: "All products", emoji: "\u{1F36C}" },
  { id: "candy", label: "Candies", emoji: "\u{1F36D}" },
  { id: "yoghurt", label: "Yoghurt", emoji: "\u{1F95B}" },
  { id: "ice_pop", label: "Ice pops", emoji: "\u{1F367}" },
];

const sortOptions: { id: SortOption; label: string }[] = [
  { id: "featured", label: "Featured" },
  { id: "price_asc", label: "Price: low to high" },
  { id: "price_desc", label: "Price: high to low" },
  { id: "name", label: "Name: A to Z" },
];

const categoryEmoji = (productCategory: ProductCategory) =>
  productCategory === "candy"
    ? "\u{1F36C}"
    : productCategory === "yoghurt"
      ? "\u{1F95B}"
      : "\u{1F367}";

/** Prefer local images for known product categories / names. */
function getLocalProductImage(product: Product): string | null {
  const productName = product.name.trim().toLowerCase();

  if (product.category === "ice_pop") return "/products/icepop.jpeg";
  if (product.category === "yoghurt") return "/products/youghurt.jpeg";

  if (productName.includes("chocolate") || productName.includes("duos")) {
    return "/products/chocolate.jpeg";
  }

  if (product.category === "candy") return "/products/sweets.jpeg";

  return getProductImage(product.image) || null;
}

const moneyFormatter = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 2,
});
const money = (amount: string | number) => moneyFormatter.format(Number(amount));

const whatsappNumber = (
  import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined
)?.replace(/\D/g, "");

// Accepts 07xx, 01xx, 7xx, 1xx, 254..., +254... (spaces and dashes ignored)
const KENYA_PHONE = /^(?:\+?254|0)?[17]\d{8}$/;
const isValidPhone = (value: string) =>
  KENYA_PHONE.test(value.replace(/[\s-]/g, ""));

function readStoredCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CartItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as CartItem).quantity === "number" &&
        typeof (item as CartItem).product?.id === "number"
    );
  } catch {
    return [];
  }
}

/** Turns any API/Axios error into a friendly message. */
function getErrorMessage(err: unknown): string {
  const fallback = "We couldn't place your order. Please try again.";

  if (typeof err !== "object" || err === null) return fallback;

  if (!("response" in err)) {
    return "We couldn't reach the shop. Check your internet connection and try again.";
  }

  const data = (err as { response?: { data?: unknown } }).response?.data;
  if (!data || typeof data !== "object") return fallback;

  const record = data as Record<string, unknown>;
  const toText = (value: unknown): string | null => {
    if (typeof value === "string") return value;
    if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
      return value.join(" ");
    }
    return null;
  };

  const preferred = ["detail", "items", "delivery_address", "customer_phone"];
  for (const key of preferred) {
    const text = toText(record[key]);
    if (text) return text;
  }

  for (const value of Object.values(record)) {
    const text = toText(value);
    if (text) return text;
  }

  return fallback;
}

type CustomerForm = {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  fulfillment_method: "collection" | "delivery";
  delivery_address: string;
  customer_notes: string;
};

const emptyCustomer: CustomerForm = {
  customer_name: "",
  customer_phone: "",
  customer_email: "",
  fulfillment_method: "collection",
  delivery_address: "",
  customer_notes: "",
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>(readStoredCart);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [sort, setSort] = useState<SortOption>("featured");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successOrder, setSuccessOrder] = useState<CheckoutResponse | null>(null);
  const [whatsappOrderMessage, setWhatsappOrderMessage] = useState("");
  const [whatsappNotice, setWhatsappNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState("");
  const [activeSection, setActiveSection] = useState("home");
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});
  const [customer, setCustomer] = useState<CustomerForm>(emptyCustomer);
  const [phoneTouched, setPhoneTouched] = useState(false);

  const toastTimer = useRef<number | undefined>(undefined);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  /* ----- toast ----- */
  const showToast = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2400);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  /* ----- load products (and reconcile cart with fresh stock/prices) ----- */
  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");
      const data = await getProducts();
      const available = data.filter((product) => product.is_available);
      setProducts(available);

      setCart((current) =>
        current
          .map((item) => {
            const fresh = available.find((p) => p.id === item.product.id);
            if (!fresh || fresh.stock_quantity < 1) return null;
            return {
              product: fresh,
              quantity: Math.min(item.quantity, fresh.stock_quantity),
            };
          })
          .filter((item): item is CartItem => item !== null)
      );
    } catch {
      setLoadError(
        "We couldn't load the products. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  /* ----- persist cart ----- */
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Storage can be unavailable (private mode) — the cart still works in-memory.
    }
  }, [cart]);

  /* ----- debounce search ----- */
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search), 200);
    return () => window.clearTimeout(id);
  }, [search]);

  /* ----- Escape key + body scroll lock for overlays ----- */
  const anyOverlayOpen = cartOpen || checkoutOpen || !!successOrder;

  useEffect(() => {
    if (!anyOverlayOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (successOrder) {
        setSuccessOrder(null);
        setWhatsappOrderMessage("");
        setWhatsappNotice("");
        setCopied(false);
      } else if (checkoutOpen && !submitting) {
        setCheckoutOpen(false);
      } else if (cartOpen) {
        setCartOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [anyOverlayOpen, cartOpen, checkoutOpen, submitting, successOrder]);

  /* Auto-focus name field when checkout opens */
  useEffect(() => {
    if (checkoutOpen) {
      const t = window.setTimeout(() => nameInputRef.current?.focus(), 50);
      return () => window.clearTimeout(t);
    }
  }, [checkoutOpen]);

  /* ----- highlight current nav link while scrolling ----- */
  useEffect(() => {
    const ids = ["home", "products", "track", "about"];
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0 || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: "-30% 0px -50% 0px", threshold: [0, 0.25, 0.5, 1] }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [loading]);

  /* ----- derived data ----- */
  const filteredProducts = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();

    const list = products.filter((product) => {
      const matchesCategory =
        category === "all" || product.category === category;
      const matchesSearch =
        !term ||
        product.name.toLowerCase().includes(term) ||
        (product.description ?? "").toLowerCase().includes(term);
      return matchesCategory && matchesSearch;
    });

    switch (sort) {
      case "price_asc":
        return [...list].sort((a, b) => Number(a.price) - Number(b.price));
      case "price_desc":
        return [...list].sort((a, b) => Number(b.price) - Number(a.price));
      case "name":
        return [...list].sort((a, b) => a.name.localeCompare(b.name));
      default:
        return list;
    }
  }, [products, category, debouncedSearch, sort]);

  const quantityInCart = useMemo(() => {
    const map = new Map<number, number>();
    cart.forEach((item) => map.set(item.product.id, item.quantity));
    return map;
  }, [cart]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0
  );

  const phoneLooksValid =
    customer.customer_phone.trim().length === 0 ||
    isValidPhone(customer.customer_phone);

  /* ----- cart actions ----- */
  function addToCart(product: Product) {
    if (product.stock_quantity < 1) return;

    const already = quantityInCart.get(product.id) ?? 0;
    if (already >= product.stock_quantity) {
      showToast(`That's all we have of ${product.name} right now`);
      return;
    }

    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: Math.min(item.quantity + 1, product.stock_quantity),
              }
            : item
        );
      }
      return [...current, { product, quantity: 1 }];
    });

    showToast(`${product.name} added to cart`);
  }

  function updateQuantity(productId: number, change: number) {
    setCart((current) =>
      current
        .map((item) =>
          item.product.id === productId
            ? {
                ...item,
                quantity: Math.min(
                  item.product.stock_quantity,
                  item.quantity + change
                ),
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeFromCart(productId: number) {
    setCart((current) => current.filter((item) => item.product.id !== productId));
    showToast("Item removed");
  }

  function updateCustomer<K extends keyof CustomerForm>(
    field: K,
    value: CustomerForm[K]
  ) {
    setCustomer((current) => ({ ...current, [field]: value }));
  }

  /* ----- WhatsApp ----- */
  function openWhatsApp(message: string): boolean {
    if (!whatsappNumber) {
      setWhatsappNotice(
        "WhatsApp isn't set up yet. Add VITE_WHATSAPP_NUMBER to frontend/.env."
      );
      showToast("WhatsApp isn't set up yet");
      return false;
    }

    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    return true;
  }

  function contactOnWhatsApp() {
    openWhatsApp(`Hello ${BUSINESS_NAME}! I'd like to ask about your products.`);
  }

  function orderProductDirectly(product: Product) {
    const quantity = Math.max(1, quantityInCart.get(product.id) ?? 1);
    const message = [
      `Hello ${BUSINESS_NAME}!`,
      "",
      "I'd like to order this product directly:",
      `Product: ${product.name}`,
      `Price: ${money(product.price)}`,
      `Quantity: ${quantity}`,
      `Total: ${money(Number(product.price) * quantity)}`,
      "",
      "Please confirm availability and how I can pay.",
    ].join("\n");

    openWhatsApp(message);
  }

  /* ----- checkout ----- */
  function openCheckout() {
    setCartOpen(false);
    setCheckoutOpen(true);
    setFormError("");
    setPhoneTouched(false);
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    if (cart.length === 0) {
      setFormError("Add at least one treat to your cart first.");
      return;
    }

    if (!isValidPhone(customer.customer_phone)) {
      setPhoneTouched(true);
      setFormError("Enter a valid phone number, like 0712 345 678.");
      return;
    }

    if (
      customer.fulfillment_method === "delivery" &&
      !customer.delivery_address.trim()
    ) {
      setFormError("Please enter your delivery address.");
      return;
    }

    setSubmitting(true);
    setFormError("");

    try {
      const orderedItems = cart.map((item) => ({
        name: item.product.name,
        quantity: item.quantity,
        lineTotal: Number(item.product.price) * item.quantity,
      }));

      const response = await api.post<CheckoutResponse>("/orders/", {
        ...customer,
        customer_name: customer.customer_name.trim(),
        customer_phone: customer.customer_phone.replace(/[\s-]/g, ""),
        customer_email: customer.customer_email.trim(),
        customer_notes: customer.customer_notes.trim(),
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
        })),
      });

      const order = response.data;
      const isDelivery = customer.fulfillment_method === "delivery";

      const messageLines = [
        `Hello ${BUSINESS_NAME}! \u{1F36C}`,
        "",
        "I'd like to follow up on my online order.",
        `Order number: ${order.order_number}`,
        "",
        "ORDER SUMMARY",
        ...orderedItems.map(
          (item) =>
            `\u2022 ${item.name} x ${item.quantity} \u2014 ${money(item.lineTotal)}`
        ),
        "",
        `Order total: ${money(order.total ?? cartTotal)}`,
        "",
        "CUSTOMER DETAILS",
        `Name: ${customer.customer_name.trim()}`,
        `Phone: ${customer.customer_phone.trim()}`,
        `Fulfilment: ${isDelivery ? "Delivery" : "Collection"}`,
        ...(isDelivery
          ? [`Delivery address: ${customer.delivery_address.trim()}`]
          : []),
        ...(customer.customer_email.trim()
          ? [`Email: ${customer.customer_email.trim()}`]
          : []),
        ...(customer.customer_notes.trim()
          ? [`Extra notes: ${customer.customer_notes.trim()}`]
          : []),
        "",
        "Please confirm the order and any applicable delivery fee. Thank you!",
      ];

      setWhatsappOrderMessage(messageLines.join("\n"));
      setSuccessOrder(order);
      setCart([]);
      setCheckoutOpen(false);
      setCartOpen(false);
      // Keep name/phone for next time, clear the one-off fields.
      setCustomer((current) => ({
        ...current,
        delivery_address: isDelivery ? current.delivery_address : "",
        customer_notes: "",
      }));

      try {
        const refreshed = await getProducts();
        setProducts(refreshed.filter((product) => product.is_available));
      } catch {
        // Keep the confirmation visible if refreshing stock fails.
      }
    } catch (err: unknown) {
      setFormError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function copyOrderNumber(orderNumber: string) {
    try {
      await navigator.clipboard.writeText(orderNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast("Couldn't copy. Please note the number down.");
    }
  }

  function closeSuccess() {
    setSuccessOrder(null);
    setWhatsappOrderMessage("");
    setWhatsappNotice("");
    setCopied(false);
  }

  const navClass = (id: string) =>
    activeSection === id ? "nav-active" : undefined;

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  return (
    <div className="shop">
      <div className="announcement">
        <Sparkles size={15} />
        <span>A little sweetness goes a long way!</span>
        <Sparkles size={15} />
      </div>

      <header className="site-header">
        <a className="brand" href="#home" aria-label="ALEX CANDY home">
          <span className="brand-icon brand-logo-frame">
            <img
              className="brand-logo"
              src="/logo.jpeg"
              alt="ALEX CANDY logo"
            />
          </span>
          <span className="brand-copy">
            <strong>ALEX CANDY</strong>
            <small>ENTERPRICE {"\u00B7"} SWEETNESS FOR EVERYONE</small>
          </span>
        </a>

        <nav className="desktop-nav" aria-label="Main navigation">
          <a className={navClass("home")} href="#home">
            Home
          </a>
          <a className={navClass("products")} href="#products">
            Our products
          </a>
          <a className={navClass("track")} href="#track">
            Track order
          </a>
          <a className={navClass("about")} href="#about">
            About us
          </a>
        </nav>

        <div className="header-actions">
          <button
            className="icon-button cart-button"
            onClick={() => setCartOpen(true)}
            aria-label={`Open cart, ${cartCount} items`}
          >
            <ShoppingBag size={21} />
            <span>Cart</span>
            <b>{cartCount}</b>
          </button>
        </div>
      </header>

      <main>
        <section className="hero" id="home">
          <div className="hero-copy">
            <span className="eyebrow">
              <Sparkles size={16} /> YOUR HAPPY PLACE FOR PRODUCTS
            </span>
            <h1>
              Life is better
              <br />
              with a little
              <br />
              <span>sweetness!</span>
            </h1>
            <p>
              From colourful candies to creamy yoghurt and refreshing ice
              pops, find a little happiness in every bite.
            </p>
            <div className="hero-actions">
              <a className="primary-button" href="#products">
                Explore Products <ArrowRight size={18} />
              </a>
              <button className="text-button" onClick={contactOnWhatsApp}>
                Talk to us
              </button>
            </div>
            <div className="hero-note">
              <span className="avatar-stack">
                <i>{"\u{1F36D}"}</i>
                <i>{"\u{1F366}"}</i>
                <i>{"\u{1F36C}"}</i>
              </span>
              <span>
                <strong>Made for happy moments</strong>
                <small>Pick your favourites today</small>
              </span>
            </div>
          </div>

          <div className="hero-art" aria-label="Colourful sweet products">
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />
            <div className="hero-sun">{"\u2726"}</div>
            <span className="floating-sweet sweet-one">{"\u{1F36D}"}</span>
            <span className="floating-sweet sweet-two">{"\u{1F36C}"}</span>
            <span className="floating-sweet sweet-three">{"\u{1F366}"}</span>
            <span className="floating-sweet sweet-four">{"\u{1F367}"}</span>
            <div className="hero-sticker">
              <span>100%</span>
              <strong>
                HAPPY
                <br />
                VIBES
              </strong>
            </div>
            <div className="hero-caption">
              <span>{"\u2661"}</span>
              <div>
                <strong>Sweeten your day</strong>
                <small>One treat at a time</small>
              </div>
            </div>
          </div>
        </section>

        <section className="benefits" id="about">
          <div className="benefit">
            <span className="benefit-icon pink">{"\u{1F36C}"}</span>
            <div>
              <strong>Sweet selection</strong>
              <small>Products for every craving</small>
            </div>
          </div>
          <div className="benefit">
            <span className="benefit-icon yellow">{"\u2728"}</span>
            <div>
              <strong>Happy moments</strong>
              <small>Little joys, big smiles</small>
            </div>
          </div>
          <div className="benefit">
            <span className="benefit-icon green">{"\u{1F6CD}\uFE0F"}</span>
            <div>
              <strong>Easy ordering</strong>
              <small>Order online in a few clicks</small>
            </div>
          </div>
          <div className="benefit">
            <span className="benefit-icon purple">{"\u{1F497}"}</span>
            <div>
              <strong>Your choice</strong>
              <small>Delivery or collection</small>
            </div>
          </div>
        </section>

        <section className="products-section" id="products">
          <div className="section-heading">
            <div>
              <span className="eyebrow">A WORLD OF YUM</span>
              <h2>
                Find your happy treat <span>{"\u2661"}</span>
              </h2>
              <p>What&apos;s making your taste buds smile today?</p>
            </div>
            <div className="search-box">
              <Search size={18} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search sweet products..."
                aria-label="Search products"
              />
              {search && (
                <button onClick={() => setSearch("")} aria-label="Clear search">
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          <div className="toolbar-row">
            <div
              className="category-row"
              aria-label="Filter products by category"
            >
              {categories.map((item) => (
                <button
                  key={item.id}
                  className={`category-chip ${
                    category === item.id ? "selected" : ""
                  }`}
                  aria-pressed={category === item.id}
                  onClick={() => setCategory(item.id)}
                >
                  <span>{item.emoji}</span> {item.label}
                </button>
              ))}
            </div>

            <label className="sort-control">
              <span>Sort by</span>
              <select
                value={sort}
                onChange={(event) =>
                  setSort(event.target.value as SortOption)
                }
              >
                {sortOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loading ? (
            <div
              className="product-grid"
              aria-busy="true"
              aria-label="Loading products"
            >
              {Array.from({ length: 6 }).map((_, index) => (
                <div className="product-card skeleton-card" key={index}>
                  <div className="skeleton skeleton-image" />
                  <div className="skeleton skeleton-line" />
                  <div className="skeleton skeleton-line short" />
                </div>
              ))}
            </div>
          ) : loadError && products.length === 0 ? (
            <div className="state-message" role="alert">
              <span className="state-emoji">{"\u{1F36D}"}</span>
              <h3>Our sweet shelf is taking a break</h3>
              <p>{loadError}</p>
              <button
                className="primary-button"
                onClick={() => void loadProducts()}
              >
                Try again
              </button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="state-message">
              <span className="state-emoji">{"\u{1F36C}"}</span>
              <h3>No products found just yet</h3>
              <p>Try another search or choose a different category.</p>
              <button
                className="secondary-button"
                onClick={() => {
                  setSearch("");
                  setCategory("all");
                }}
              >
                Show all products
              </button>
            </div>
          ) : (
            <div className="product-grid">
              {filteredProducts.map((product, index) => {
                const imageUrl = getLocalProductImage(product);
                const inCart = quantityInCart.get(product.id) ?? 0;
                const soldOut = product.stock_quantity < 1;
                const maxedOut = inCart >= product.stock_quantity;
                const lowStock =
                  !soldOut && product.stock_quantity <= LOW_STOCK_THRESHOLD;

                return (
                  <article
                    className={`product-card product-card-${index % 4} ${
                      soldOut ? "is-sold-out" : ""
                    }`}
                    key={product.id}
                  >
                    <div className="product-image">
                      {imageUrl && !failedImages[product.id] ? (
                        <img
                          src={imageUrl}
                          alt={product.name}
                          loading="lazy"
                          decoding="async"
                          onError={() =>
                            setFailedImages((current) => ({
                              ...current,
                              [product.id]: true,
                            }))
                          }
                        />
                      ) : (
                        <span className="product-emoji" aria-hidden="true">
                          {categoryEmoji(product.category)}
                        </span>
                      )}
                      <span className="product-category">
                        {
                          categories.find(
                            (item) => item.id === product.category
                          )?.label
                        }
                      </span>
                      {soldOut && (
                        <span className="stock-badge sold-out">Sold out</span>
                      )}
                      {lowStock && (
                        <span className="stock-badge low">
                          Only {product.stock_quantity} left
                        </span>
                      )}
                    </div>

                    <div className="product-details">
                      <h3>{product.name}</h3>
                      <p>
                        {product.description ||
                          "A little treat to brighten your day."}
                      </p>
                      <div className="product-bottom">
                        <div>
                          <strong className="product-price">
                            {money(product.price)}
                          </strong>
                          <small>
                            {soldOut
                              ? "Currently sold out"
                              : inCart > 0
                                ? `${inCart} in your cart`
                                : `${product.stock_quantity} available`}
                          </small>
                        </div>

                        {inCart > 0 && !soldOut ? (
                          <div className="quantity-control card-qty">
                            <button
                              onClick={() =>
                                updateQuantity(product.id, -1)
                              }
                              aria-label={`Decrease ${product.name} quantity`}
                            >
                              <Minus size={14} />
                            </button>
                            <span aria-live="polite">{inCart}</span>
                            <button
                              onClick={() => updateQuantity(product.id, 1)}
                              disabled={maxedOut}
                              aria-label={`Increase ${product.name} quantity`}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            className="add-button"
                            onClick={() => addToCart(product)}
                            disabled={soldOut || maxedOut}
                            aria-label={`Add ${product.name} to cart`}
                          >
                            <Plus size={20} />
                          </button>
                        )}
                      </div>

                      <button
                        className="product-whatsapp-button"
                        onClick={() => orderProductDirectly(product)}
                        disabled={soldOut}
                      >
                        <MessageCircle size={15} />
                        Order direct on WhatsApp
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {whatsappNotice && !successOrder && (
            <div className="notice error-notice" role="alert">
              {whatsappNotice}
              <button
                onClick={() => setWhatsappNotice("")}
                aria-label="Dismiss message"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </section>

        <OrderTracking />

        <section className="bottom-banner">
          <div className="banner-emoji">{"\u{1F36D}"}</div>
          <div>
            <span className="eyebrow">A LITTLE TREAT, A LOT OF JOY</span>
            <h2>Ready to make today sweeter?</h2>
            <p>Choose your favourites and place your order in minutes.</p>
          </div>
          <a className="banner-button" href="#products">
            Shop products <ArrowRight size={18} />
          </a>
        </section>
      </main>

      <footer className="site-footer">
        <a className="brand footer-brand" href="#home">
          <span className="brand-icon brand-logo-frame">
            <img
              className="brand-logo"
              src="/logo.jpeg"
              alt="ALEX CANDY logo"
            />
          </span>
          <span className="brand-copy">
            <strong>ALEX CANDY</strong>
            <small>ENTERPRICE</small>
          </span>
        </a>
        <p>Making everyday moments a little sweeter. {"\u{1F497}"}</p>
        <span>
          {"\u00A9"} {new Date().getFullYear()} {BUSINESS_NAME}
        </span>
      </footer>

      {/* ---------------- Cart ---------------- */}
      {cartOpen && (
        <div
          className="overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCartOpen(false);
          }}
        >
          <aside
            className="side-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Shopping cart"
          >
            <div className="panel-heading">
              <div>
                <span className="eyebrow">YOUR SWEET PICKS</span>
                <h2>Your cart ({cartCount})</h2>
              </div>
              <button
                className="close-button"
                onClick={() => setCartOpen(false)}
                aria-label="Close cart"
              >
                <X />
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="empty-cart">
                <span>{"\u{1F6CD}\uFE0F"}</span>
                <h3>Your cart is waiting for products!</h3>
                <p>Add some goodies and they&apos;ll appear here.</p>
                <button
                  className="primary-button"
                  onClick={() => setCartOpen(false)}
                >
                  Browse products
                </button>
              </div>
            ) : (
              <>
                <div className="cart-items">
                  {cart.map((item) => {
                    const imageUrl = getLocalProductImage(item.product);
                    return (
                      <div className="cart-item" key={item.product.id}>
                        <div className="cart-item-emoji">
                          {imageUrl && !failedImages[item.product.id] ? (
                            <img
                              className="cart-item-image"
                              src={imageUrl}
                              alt=""
                              decoding="async"
                              onError={() =>
                                setFailedImages((current) => ({
                                  ...current,
                                  [item.product.id]: true,
                                }))
                              }
                            />
                          ) : (
                            categoryEmoji(item.product.category)
                          )}
                        </div>
                        <div className="cart-item-info">
                          <strong>{item.product.name}</strong>
                          <span>
                            {money(item.product.price)} each {"\u00B7"}{" "}
                            <b>
                              {money(
                                Number(item.product.price) * item.quantity
                              )}
                            </b>
                          </span>
                          <div className="quantity-control">
                            <button
                              onClick={() =>
                                updateQuantity(item.product.id, -1)
                              }
                              aria-label={`Decrease ${item.product.name} quantity`}
                            >
                              <Minus size={14} />
                            </button>
                            <span aria-live="polite">{item.quantity}</span>
                            <button
                              onClick={() =>
                                updateQuantity(item.product.id, 1)
                              }
                              disabled={
                                item.quantity >= item.product.stock_quantity
                              }
                              aria-label={`Increase ${item.product.name} quantity`}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>
                        <button
                          className="remove-button"
                          onClick={() => removeFromCart(item.product.id)}
                          aria-label={`Remove ${item.product.name}`}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="cart-summary">
                  <div className="summary-line">
                    <span>Subtotal</span>
                    <strong>{money(cartTotal)}</strong>
                  </div>
                  <p>
                    Delivery fees, if applicable, will be confirmed
                    separately.
                  </p>
                  <button
                    className="primary-button full-button"
                    onClick={openCheckout}
                  >
                    Continue to checkout <ArrowRight size={18} />
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      {/* ---------------- Checkout ---------------- */}
      {checkoutOpen && (
        <div
          className="overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !submitting) {
              setCheckoutOpen(false);
            }
          }}
        >
          <section
            className="checkout-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Checkout form"
          >
            <div className="panel-heading">
              <div>
                <span className="eyebrow">ALMOST THERE!</span>
                <h2>Let&apos;s place your order</h2>
                <p className="modal-subtitle">
                  Tell us where to send your sweetness.
                </p>
              </div>
              <button
                className="close-button"
                disabled={submitting}
                onClick={() => setCheckoutOpen(false)}
                aria-label="Close checkout"
              >
                <X />
              </button>
            </div>

            {formError && (
              <div className="notice error-notice" role="alert">
                {formError}
                <button
                  onClick={() => setFormError("")}
                  aria-label="Dismiss message"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <form className="checkout-form" onSubmit={submitOrder}>
              <label>
                Your full name
                <input
                  ref={nameInputRef}
                  required
                  autoComplete="name"
                  minLength={2}
                  maxLength={150}
                  value={customer.customer_name}
                  onChange={(event) =>
                    updateCustomer("customer_name", event.target.value)
                  }
                  placeholder="e.g. Alex Mwangi"
                />
              </label>

              <label>
                Phone number
                <input
                  required
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={30}
                  value={customer.customer_phone}
                  onChange={(event) =>
                    updateCustomer("customer_phone", event.target.value)
                  }
                  onBlur={() => setPhoneTouched(true)}
                  placeholder="e.g. 0712 345 678"
                  aria-invalid={phoneTouched && !phoneLooksValid}
                />
                {phoneTouched && !phoneLooksValid && (
                  <small className="field-hint error">
                    Use a valid Kenyan number (e.g. 0712 345 678)
                  </small>
                )}
              </label>

              <label>
                Email address{" "}
                <span className="optional-label">Optional</span>
                <input
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  value={customer.customer_email}
                  onChange={(event) =>
                    updateCustomer("customer_email", event.target.value)
                  }
                  placeholder="you@example.com"
                />
              </label>

              <fieldset className="fulfillment-options">
                <legend>How would you like your order?</legend>
                <label
                  className={`fulfillment-option ${
                    customer.fulfillment_method === "collection"
                      ? "chosen"
                      : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="fulfillment"
                    value="collection"
                    checked={customer.fulfillment_method === "collection"}
                    onChange={() =>
                      updateCustomer("fulfillment_method", "collection")
                    }
                  />
                  <PackageCheck size={20} />
                  <span>
                    <strong>Collection</strong>
                    <small>Pick it up yourself</small>
                  </span>
                </label>
                <label
                  className={`fulfillment-option ${
                    customer.fulfillment_method === "delivery" ? "chosen" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="fulfillment"
                    value="delivery"
                    checked={customer.fulfillment_method === "delivery"}
                    onChange={() =>
                      updateCustomer("fulfillment_method", "delivery")
                    }
                  />
                  <MapPin size={20} />
                  <span>
                    <strong>Delivery</strong>
                    <small>Bring it to your address</small>
                  </span>
                </label>
              </fieldset>

              {customer.fulfillment_method === "delivery" && (
                <label>
                  Delivery address
                  <textarea
                    required
                    autoComplete="street-address"
                    maxLength={2000}
                    rows={3}
                    value={customer.delivery_address}
                    onChange={(event) =>
                      updateCustomer("delivery_address", event.target.value)
                    }
                    placeholder="Estate, street, building and nearby landmark"
                  />
                </label>
              )}

              <label>
                Extra notes{" "}
                <span className="optional-label">Optional</span>
                <textarea
                  rows={2}
                  maxLength={2000}
                  value={customer.customer_notes}
                  onChange={(event) =>
                    updateCustomer("customer_notes", event.target.value)
                  }
                  placeholder="Any special instructions?"
                />
              </label>

              <div className="checkout-total">
                <span>
                  {cartCount} item{cartCount === 1 ? "" : "s"} {"\u00B7"}{" "}
                  Order total
                </span>
                <strong>{money(cartTotal)}</strong>
              </div>

              <button
                className="primary-button full-button"
                type="submit"
                disabled={submitting || cart.length === 0}
              >
                {submitting ? (
                  <>
                    <LoaderCircle className="spin" size={18} /> Placing
                    order...
                  </>
                ) : (
                  <>
                    Place my order <ArrowRight size={18} />
                  </>
                )}
              </button>
              <p className="secure-note">
                Your order will be saved and sent to our shop for processing.
              </p>
            </form>
          </section>
        </div>
      )}

      {/* ---------------- Success ---------------- */}
      {successOrder && (
        <div className="overlay">
          <section
            className="success-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Order confirmation"
          >
            <div className="success-icon">
              <CheckCircle2 size={42} />
            </div>
            <span className="eyebrow">ORDER RECEIVED!</span>
            <h2>Thanks for your order! {"\u{1F497}"}</h2>
            <p>Your order has been saved. Keep this number to track it.</p>

            <div className="order-reference">
              <span>YOUR ORDER NUMBER</span>
              <strong>{successOrder.order_number}</strong>
              <button
                className="secondary-button"
                onClick={() => void copyOrderNumber(successOrder.order_number)}
              >
                {copied ? (
                  <>
                    <Check size={16} /> Copied
                  </>
                ) : (
                  <>
                    <Copy size={16} /> Copy order number
                  </>
                )}
              </button>
            </div>

            <p className="success-total">
              Order total: <strong>{money(successOrder.total)}</strong>
            </p>

            <button
              className="primary-button full-button"
              onClick={() => openWhatsApp(whatsappOrderMessage)}
            >
              <MessageCircle size={19} />
              Send order summary on WhatsApp
            </button>

            {whatsappNotice && (
              <p className="secure-note">{whatsappNotice}</p>
            )}

            <button
              className="secondary-button full-button"
              onClick={closeSuccess}
            >
              Back to sweet shopping <ArrowRight size={18} />
            </button>
          </section>
        </div>
      )}

      {/* ---------------- Toast & floating cart ---------------- */}
      <div className="toast-region" aria-live="polite" role="status">
        {toast && <div className="toast">{toast}</div>}
      </div>

      {!anyOverlayOpen && (
        <button
          className={`floating-cart ${cartCount === 0 ? "is-empty" : ""}`}
          onClick={() => setCartOpen(true)}
          aria-label={`Open shopping cart with ${cartCount} items`}
        >
          <ShoppingCart size={22} />
          <span>{cartCount}</span>
        </button>
      )}
    </div>
  );
}

export default App;