
from decimal import Decimal

from django.test import TestCase

from products.models import Product
from .models import Order, OrderItem


class OrderModelTests(TestCase):
    def setUp(self):
        self.candy = Product.objects.create(
            name="Strawberry Gummies",
            category=Product.Category.CANDY,
            description="Strawberry-flavoured gummies",
            price=Decimal("50.00"),
            stock_quantity=20,
            is_available=True,
        )

        self.order = Order.objects.create(
            customer_name="Test Customer",
            customer_phone="0712345678",
            fulfillment_method=Order.FulfillmentMethod.COLLECTION,
        )

    def test_order_has_unique_order_number(self):
        another_order = Order.objects.create(
            customer_name="Another Customer",
            customer_phone="0798765432",
        )

        self.assertNotEqual(
            self.order.order_number,
            another_order.order_number,
        )

    def test_order_item_calculates_line_total(self):
        item = OrderItem.objects.create(
            order=self.order,
            product=self.candy,
            quantity=3,
            unit_price=Decimal("50.00"),
        )

        self.assertEqual(item.line_total, Decimal("150.00"))

    def test_order_total_sums_all_items(self):
        OrderItem.objects.create(
            order=self.order,
            product=self.candy,
            quantity=2,
            unit_price=Decimal("50.00"),
        )
        OrderItem.objects.create(
            order=self.order,
            product=self.candy,
            quantity=1,
            unit_price=Decimal("50.00"),
        )

        self.assertEqual(self.order.total, Decimal("150.00"))

    def test_new_order_defaults_to_pending(self):
        self.assertEqual(
            self.order.status,
            Order.Status.PENDING,
        )
