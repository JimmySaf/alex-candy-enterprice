
from django.contrib import admin
from django.utils import timezone

from .models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    can_delete = False
    fields = ("product", "quantity", "unit_price")
    readonly_fields = ("product", "quantity", "unit_price")
    show_change_link = False


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
    list_filter = (
        "status",
        "fulfillment_method",
        "created_at",
    )
    search_fields = (
        "order_number",
        "customer_name",
        "customer_phone",
        "customer_email",
    )
    readonly_fields = (
        "order_number",
        "created_at",
        "updated_at",
    )
    inlines = [OrderItemInline]
    date_hierarchy = "created_at"
    list_per_page = 25
    ordering = ("-created_at",)

    actions = (
        "mark_confirmed",
        "mark_preparing",
        "mark_ready",
        "mark_completed",
        "mark_cancelled",
    )

    @admin.action(description="Mark selected orders as confirmed")
    def mark_confirmed(self, request, queryset):
        self._update_order_status(queryset, Order.Status.CONFIRMED)

    @admin.action(description="Mark selected orders as preparing")
    def mark_preparing(self, request, queryset):
        self._update_order_status(queryset, Order.Status.PREPARING)

    @admin.action(description="Mark selected orders as ready")
    def mark_ready(self, request, queryset):
        self._update_order_status(queryset, Order.Status.READY)

    @admin.action(description="Mark selected orders as completed")
    def mark_completed(self, request, queryset):
        self._update_order_status(queryset, Order.Status.COMPLETED)

    @admin.action(description="Cancel selected orders")
    def mark_cancelled(self, request, queryset):
        self._update_order_status(queryset, Order.Status.CANCELLED)

    def _update_order_status(self, queryset, status):
        for order in queryset.iterator():
            if order.status != status:
                order.status = status
                order.save(update_fields=["status", "updated_at"])


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = (
        "order",
        "product",
        "quantity",
        "unit_price",
    )
    search_fields = (
        "order__order_number",
        "product__name",
    )
    list_per_page = 25
    readonly_fields = (
        "order",
        "product",
        "quantity",
        "unit_price",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
