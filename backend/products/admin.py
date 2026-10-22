
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
    )
    list_filter = ("category", "is_available")
    search_fields = ("name", "description")
    list_editable = ("price", "stock_quantity", "is_available")
