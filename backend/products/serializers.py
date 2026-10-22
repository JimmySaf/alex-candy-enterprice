
from rest_framework import serializers
from .models import Product


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "category",
            "description",
            "price",
            "image",
            "stock_quantity",
            "is_available",
            "created_at",
            "updated_at",
        ]
