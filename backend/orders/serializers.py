import re

from django.db import transaction
from rest_framework import serializers

from products.models import Product
from .models import Order, OrderItem, Payment


def normalize_phone(phone):
    """
    Normalize a Kenyan phone number for comparison.

    Examples:
    0712345678 -> 712345678
    254712345678 -> 712345678
    +254712345678 -> 712345678
    """
    digits = re.sub(r"\D", "", phone)
    return digits[-9:]


class OrderItemInputSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1, max_value=1000)


class OrderItemReadSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(
        source="product.name",
        read_only=True,
    )
    line_total = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = OrderItem
        fields = [
            "product_name",
            "quantity",
            "unit_price",
            "line_total",
        ]


class OrderCreateSerializer(serializers.ModelSerializer):
    items = OrderItemInputSerializer(many=True, write_only=True)
    total = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = Order
        fields = [
            "order_number",
            "customer_name",
            "customer_phone",
            "customer_email",
            "fulfillment_method",
            "delivery_address",
            "customer_notes",
            "items",
            "status",
            "total",
            "created_at",
        ]
        read_only_fields = [
            "order_number",
            "status",
            "total",
            "created_at",
        ]

    def validate(self, attrs):
        items = attrs.get("items", [])

        if not items:
            raise serializers.ValidationError({
                "items": "Add at least one product to your order."
            })

        product_ids = [item["product_id"] for item in items]

        if len(product_ids) != len(set(product_ids)):
            raise serializers.ValidationError({
                "items": (
                    "Each product should appear only once. "
                    "Combine quantities for duplicate products."
                )
            })

        if (
            attrs.get("fulfillment_method")
            == Order.FulfillmentMethod.DELIVERY
            and not attrs.get("delivery_address", "").strip()
        ):
            raise serializers.ValidationError({
                "delivery_address": "A delivery address is required."
            })

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        requested_items = validated_data.pop("items")
        product_ids = [item["product_id"] for item in requested_items]

        products = Product.objects.select_for_update().filter(
            id__in=product_ids
        )
        product_map = {product.id: product for product in products}

        for item in requested_items:
            product = product_map.get(item["product_id"])

            if product is None or not product.is_available:
                raise serializers.ValidationError({
                    "items": (
                        f"Product ID {item['product_id']} "
                        "is unavailable."
                    )
                })

            if product.stock_quantity < item["quantity"]:
                raise serializers.ValidationError({
                    "items": (
                        f"Insufficient stock for {product.name}. "
                        f"Available: {product.stock_quantity}."
                    )
                })

        order = Order.objects.create(**validated_data)

        order_items = []

        for item in requested_items:
            product = product_map[item["product_id"]]
            quantity = item["quantity"]

            order_items.append(
                OrderItem(
                    order=order,
                    product=product,
                    quantity=quantity,
                    unit_price=product.price,
                )
            )

            product.stock_quantity -= quantity
            product.save(update_fields=["stock_quantity"])

        OrderItem.objects.bulk_create(order_items)

        return order


class OrderTrackingSerializer(serializers.ModelSerializer):
    items = OrderItemReadSerializer(many=True, read_only=True)
    total = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = Order
        fields = [
            "order_number",
            "status",
            "fulfillment_method",
            "created_at",
            "total",
            "items",
        ]


class PaymentSubmissionSerializer(serializers.Serializer):
    order_number = serializers.CharField(max_length=12)
    customer_phone = serializers.CharField(max_length=30)
    transaction_code = serializers.CharField(
        min_length=8,
        max_length=20,
    )
    payer_phone = serializers.CharField(max_length=30)

    def validate_transaction_code(self, value):
        code = re.sub(r"\s+", "", value).upper()

        if not re.fullmatch(r"[A-Z0-9]{8,20}", code):
            raise serializers.ValidationError(
                "Enter a valid M-Pesa transaction code."
            )

        if Payment.objects.filter(transaction_code=code).exists():
            raise serializers.ValidationError(
                "This M-Pesa transaction code has already been submitted."
            )

        return code

    def validate_payer_phone(self, value):
        normalized = normalize_phone(value)

        if not re.fullmatch(r"[17]\d{8}", normalized):
            raise serializers.ValidationError(
                "Enter a valid Kenyan M-Pesa phone number."
            )

        return value.strip()

    def validate(self, attrs):
        order_number = attrs["order_number"].strip().upper()
        customer_phone = normalize_phone(attrs["customer_phone"])

        if not customer_phone:
            raise serializers.ValidationError({
                "customer_phone": "Enter the phone number used for the order."
            })

        order = (
            Order.objects
            .filter(order_number=order_number)
            .prefetch_related("items")
            .first()
        )

        if (
            order is None
            or normalize_phone(order.customer_phone) != customer_phone
        ):
            raise serializers.ValidationError({
                "order_number": (
                    "Order not found. Check your order number "
                    "and customer phone number."
                )
            })

        if order.status == Order.Status.CANCELLED:
            raise serializers.ValidationError({
                "order_number": "Payment cannot be submitted for a cancelled order."
            })

        existing_payment = Payment.objects.filter(order=order).first()

        if existing_payment:
            if existing_payment.status != Payment.Status.REJECTED:
                raise serializers.ValidationError({
                    "order_number": (
                        "A payment has already been submitted for this order. "
                        "Contact the seller if you need assistance."
                    )
                })

            attrs["existing_payment"] = existing_payment

        attrs["order"] = order
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        order = validated_data["order"]
        existing_payment = validated_data.get("existing_payment")

        payment_data = {
            "amount": order.total,
            "transaction_code": validated_data["transaction_code"],
            "payer_phone": validated_data["payer_phone"],
            "status": Payment.Status.PENDING,
            "verified_at": None,
            "verified_by": None,
            "admin_notes": "",
        }

        if existing_payment:
            for field, value in payment_data.items():
                setattr(existing_payment, field, value)

            existing_payment.save()
            return existing_payment

        return Payment.objects.create(
            order=order,
            **payment_data,
        )


class PaymentResponseSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(
        source="order.order_number",
        read_only=True,
    )

    class Meta:
        model = Payment
        fields = [
            "order_number",
            "amount",
            "transaction_code",
            "status",
            "submitted_at",
        ]