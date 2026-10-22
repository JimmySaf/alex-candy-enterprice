
import uuid
from decimal import Decimal

from django.db import models
from django.db.models import Q

from products.models import Product


def generate_order_number():
    return uuid.uuid4().hex[:12].upper()


class Order(models.Model):
    class FulfillmentMethod(models.TextChoices):
        DELIVERY = "delivery", "Delivery"
        COLLECTION = "collection", "Customer Collection"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        CONFIRMED = "confirmed", "Confirmed"
        PREPARING = "preparing", "Preparing"
        READY = "ready", "Ready for Collection/Delivery"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    order_number = models.CharField(
        max_length=12,
        unique=True,
        default=generate_order_number,
        editable=False,
    )
    customer_name = models.CharField(max_length=150)
    customer_phone = models.CharField(max_length=30)
    customer_email = models.EmailField(blank=True)

    fulfillment_method = models.CharField(
        max_length=20,
        choices=FulfillmentMethod.choices,
        default=FulfillmentMethod.COLLECTION,
    )
    delivery_address = models.TextField(blank=True)
    customer_notes = models.TextField(blank=True)

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.order_number

    @property
    def total(self):
        return sum(
            (item.line_total for item in self.items.all()),
            start=Decimal("0.00"),
        )


class OrderItem(models.Model):
    order = models.ForeignKey(
        Order,
        related_name="items",
        on_delete=models.CASCADE,
    )
    product = models.ForeignKey(
        Product,
        related_name="order_items",
        on_delete=models.PROTECT,
    )
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(quantity__gte=1),
                name="order_item_quantity_at_least_one",
            ),
        ]

    def __str__(self):
        return f"{self.quantity} x {self.product.name}"

    @property
    def line_total(self):
        return self.unit_price * self.quantity
