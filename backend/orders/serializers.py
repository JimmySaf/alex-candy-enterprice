
from django.db import transaction
from rest_framework import serializers

from products.models import Product
from .models import Order, OrderItem


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
                "items": "Each product should appear only once. "
                         "Combine quantities for duplicate products."
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

        # Lock products where supported by the database.
        products = Product.objects.select_for_update().filter(
            id__in=product_ids
        )
        product_map = {product.id: product for product in products}

        # Validate every item before creating the order or reducing stock.
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
