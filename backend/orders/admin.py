
from django.contrib import admin

from .models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ("unit_price", "product")


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        "order_number",
        "customer_name",
        "customer_phone",
        "fulfillment_method",
        "status",
        "created_at",
    )
    list_filter = ("status", "fulfillment_method", "created_at")
    search_fields = ("order_number", "customer_name", "customer_phone")
    readonly_fields = ("order_number", "created_at", "updated_at")
    inlines = [OrderItemInline]


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ("order", "product", "quantity", "unit_price")
    search_fields = ("order__order_number", "product__name")
    readonly_fields = ("order", "product", "quantity", "unit_price")
