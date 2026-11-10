from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from products.models import Product
from .models import Order, OrderItem, Payment


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


class PaymentSubmissionTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.order = Order.objects.create(
            customer_name="Test Customer",
            customer_phone="0712345678",
            fulfillment_method=Order.FulfillmentMethod.COLLECTION,
        )

        product = Product.objects.create(
            name="Test Sweets",
            category=Product.Category.CANDY,
            description="Test product",
            price=Decimal("100.00"),
            stock_quantity=10,
            is_available=True,
        )

        OrderItem.objects.create(
            order=self.order,
            product=product,
            quantity=2,
            unit_price=Decimal("100.00"),
        )

        self.payment_url = "/api/orders/payment/"

        self.payment_data = {
            "order_number": self.order.order_number,
            "customer_phone": "0712345678",
            "transaction_code": "QWE1234567",
            "payer_phone": "0725941442",
        }

    def test_customer_can_submit_payment_details(self):
        response = self.client.post(
            self.payment_url,
            self.payment_data,
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            response.data["payment"]["status"],
            Payment.Status.PENDING,
        )

        payment = Payment.objects.get(order=self.order)

        self.assertEqual(payment.amount, Decimal("200.00"))
        self.assertEqual(payment.transaction_code, "QWE1234567")
        self.assertEqual(payment.payer_phone, "0725941442")
        self.assertEqual(payment.status, Payment.Status.PENDING)

    def test_payment_amount_comes_from_order_total(self):
        submitted_data = {
            **self.payment_data,
            "amount": "1.00",
        }

        response = self.client.post(
            self.payment_url,
            submitted_data,
            format="json",
        )

        self.assertEqual(response.status_code, 201)

        payment = Payment.objects.get(order=self.order)

        self.assertEqual(payment.amount, Decimal("200.00"))

    def test_wrong_customer_phone_is_rejected(self):
        submitted_data = {
            **self.payment_data,
            "customer_phone": "0798765432",
        }

        response = self.client.post(
            self.payment_url,
            submitted_data,
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(
            Payment.objects.filter(order=self.order).exists()
        )

    def test_duplicate_transaction_code_is_rejected(self):
        another_order = Order.objects.create(
            customer_name="Another Customer",
            customer_phone="0798765432",
        )

        Payment.objects.create(
            order=another_order,
            amount=Decimal("100.00"),
            transaction_code="QWE1234567",
            payer_phone="0725941442",
        )

        response = self.client.post(
            self.payment_url,
            self.payment_data,
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(
            Payment.objects.filter(order=self.order).exists()
        )

    def test_second_submission_for_pending_payment_is_rejected(self):
        Payment.objects.create(
            order=self.order,
            amount=Decimal("200.00"),
            transaction_code="ABC1234567",
            payer_phone="0725941442",
        )

        response = self.client.post(
            self.payment_url,
            {
                **self.payment_data,
                "transaction_code": "XYZ1234567",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_rejected_payment_can_be_resubmitted(self):
        Payment.objects.create(
            order=self.order,
            amount=Decimal("200.00"),
            transaction_code="OLD1234567",
            payer_phone="0725941442",
            status=Payment.Status.REJECTED,
        )

        response = self.client.post(
            self.payment_url,
            {
                **self.payment_data,
                "transaction_code": "NEW1234567",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)

        payment = Payment.objects.get(order=self.order)

        self.assertEqual(payment.transaction_code, "NEW1234567")
        self.assertEqual(payment.status, Payment.Status.PENDING)
        self.assertIsNone(payment.verified_at)
        self.assertIsNone(payment.verified_by)

    def test_cancelled_order_cannot_receive_payment_submission(self):
        self.order.status = Order.Status.CANCELLED
        self.order.save(update_fields=["status"])

        response = self.client.post(
            self.payment_url,
            self.payment_data,
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(
            Payment.objects.filter(order=self.order).exists()
        )