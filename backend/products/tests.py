
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from .models import Product


class ProductAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.candy = Product.objects.create(
            name="Strawberry Gummies",
            category=Product.Category.CANDY,
            description="Sweet strawberry-flavoured gummies.",
            price=Decimal("50.00"),
            stock_quantity=20,
            is_available=True,
        )

        Product.objects.create(
            name="Unavailable Ice Pop",
            category=Product.Category.ICE_POP,
            price=Decimal("20.00"),
            stock_quantity=0,
            is_available=False,
        )

    def test_customer_can_list_available_products(self):
        response = self.client.get("/api/products/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(
            response.data["results"][0]["name"],
            "Strawberry Gummies",
        )

    def test_customer_can_filter_products_by_category(self):
        response = self.client.get(
            "/api/products/",
            {"category": "candy"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)

    def test_customer_can_view_a_product(self):
        response = self.client.get(
            f"/api/products/{self.candy.id}/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["name"], "Strawberry Gummies")

    def test_customer_cannot_create_products_through_public_api(self):
        response = self.client.post(
            "/api/products/",
            {
                "name": "New Candy",
                "category": "candy",
                "price": "10.00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 405)
