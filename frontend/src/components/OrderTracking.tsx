
import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  Package,
  Search,
} from "lucide-react";
import { api } from "../lib/api";
import type { CheckoutResponse } from "../types/product";
import "./OrderTracking.css";

interface TrackedOrderItem {
  product_name: string;
  quantity: number;
  unit_price: string | number;
  line_total: string | number;
}

interface TrackedOrder {
  order_number: string;
  status: string;
  fulfillment_method: "delivery" | "collection";
  created_at: string;
  total: string | number;
  items: TrackedOrderItem[];
}

const statusSteps = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "completed",
];

const statusLabels: Record<string, string> = {
  pending: "Order received",
  confirmed: "Order confirmed",
  preparing: "Being prepared",
  ready: "Ready for collection / delivery",
  completed: "Completed",
  cancelled: "Cancelled",
};

const money = (value: string | number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 2,
  }).format(Number(value));

export default function OrderTracking() {
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function trackOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setOrder(null);

    try {
      const response = await api.get<TrackedOrder>("/orders/track/", {
        params: {
          order_number: orderNumber.trim().toUpperCase(),
          phone: phone.trim(),
        },
      });

      setOrder(response.data);
    } catch (err: unknown) {
      let message = "We couldn't find that order. Check your details and try again.";

      if (
        typeof err === "object" &&
        err !== null &&
        "response" in err
      ) {
        const response = (
          err as {
            response?: {
              data?: { detail?: string };
            };
          }
        ).response;

        if (response?.data?.detail) {
          message = response.data.detail;
        }
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const currentStep = order
    ? statusSteps.indexOf(order.status)
    : -1;

  return (
    <section className="tracking-section" id="track">
      <div className="tracking-intro">
        <span className="eyebrow">
          <Package size={15} /> YOUR ORDER, YOUR PEACE OF MIND
        </span>
        <h2>Where's my order? <span>♡</span></h2>
        <p>
          Enter the order number and phone number you used at checkout
          to see the latest status of your sweet order.
        </p>
      </div>

      <div className="tracking-card">
        <form className="tracking-form" onSubmit={trackOrder}>
          <label>
            Order number
            <input
              required
              maxLength={12}
              value={orderNumber}
              onChange={(event) => setOrderNumber(event.target.value)}
              placeholder="e.g. A1B2C3D4E5F6"
            />
          </label>

          <label>
            Phone number used at checkout
            <input
              required
              maxLength={30}
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="e.g. 0712 345 678"
            />
          </label>

          <button className="primary-button tracking-submit" type="submit" disabled={loading}>
            {loading ? (
              <>
                <LoaderCircle className="spin" size={17} />
                Checking...
              </>
            ) : (
              <>
                <Search size={17} />
                Track order
              </>
            )}
          </button>
        </form>

        {error && (
          <div className="tracking-error" role="alert">
            {error}
          </div>
        )}

        {order && (
          <div className="tracking-result">
            <div className="tracking-result-heading">
              <div className="tracking-result-icon">
                {order.status === "completed" ? (
                  <CheckCircle2 size={24} />
                ) : (
                  <Clock3 size={24} />
                )}
              </div>
              <div>
                <span className="tracking-overline">ORDER NUMBER</span>
                <h3>{order.order_number}</h3>
                <p>
                  Placed on{" "}
                  {new Date(order.created_at).toLocaleString("en-KE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
            </div>

            <div className={`status-banner ${order.status === "cancelled" ? "status-cancelled" : ""}`}>
              <span>Current status</span>
              <strong>
                {statusLabels[order.status] ??
                  order.status.replaceAll("_", " ")}
              </strong>
            </div>

            {order.status !== "cancelled" && (
              <div className="tracking-progress">
                {statusSteps.map((step, index) => {
                  const completed =
                    currentStep >= 0 && index <= currentStep;

                  return (
                    <div
                      className={`progress-step ${completed ? "is-complete" : ""}`}
                      key={step}
                    >
                      <span className="progress-dot">
                        {completed ? <CheckCircle2 size={17} /> : index + 1}
                      </span>
                      <span className="progress-label">
                        {statusLabels[step]}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="tracked-items-heading">
              <h4>What's in your order?</h4>
              <span>
                {order.fulfillment_method === "delivery"
                  ? "🚚 Delivery"
                  : "🛍️ Collection"}
              </span>
            </div>

            <div className="tracked-items">
              {order.items.map((item, index) => (
                <div
                  className="tracked-item"
                  key={`${item.product_name}-${index}`}
                >
                  <div>
                    <strong>{item.product_name}</strong>
                    <small>
                      {money(item.unit_price)} × {item.quantity}
                    </small>
                  </div>
                  <strong>{money(item.line_total)}</strong>
                </div>
              ))}
            </div>

            <div className="tracked-total">
              <span>Order total</span>
              <strong>{money(order.total)}</strong>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
