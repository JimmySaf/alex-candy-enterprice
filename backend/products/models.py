
from django.db import models


class Product(models.Model):
    class Category(models.TextChoices):
        CANDY = "candy", "Candies"
        YOGHURT = "yoghurt", "Yoghurt"
        ICE_POP = "ice_pop", "Ice Pops"

    name = models.CharField(max_length=150)
    category = models.CharField(
        max_length=20,
        choices=Category.choices,
    )
    description = models.TextField(blank=True)
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
    )
    image = models.ImageField(
        upload_to="products/",
        blank=True,
        null=True,
    )
    stock_quantity = models.PositiveIntegerField(default=0)
    is_available = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name
