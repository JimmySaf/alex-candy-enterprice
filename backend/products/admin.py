
from django.contrib import admin

from .models import Product


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "category",
        "price",
        "stock_quantity",
        "is_available",
        "created_at",
    )
    list_filter = (
        "category",
        "is_available",
        "created_at",
    )
    search_fields = (
        "name",
        "description",
    )
    list_editable = (
        "price",
        "stock_quantity",
        "is_available",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
    )
    list_per_page = 25
    ordering = ("name",)

    actions = (
        "make_available",
        "make_unavailable",
    )

    @admin.action(description="Make selected products available")
    def make_available(self, request, queryset):
        queryset.update(is_available=True)

    @admin.action(description="Hide selected products from the store")
    def make_unavailable(self, request, queryset):
        queryset.update(is_available=False)
