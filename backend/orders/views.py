from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Order
from .serializers import (
    OrderCreateSerializer,
    OrderTrackingSerializer,
    PaymentSubmissionSerializer,
    PaymentResponseSerializer,
)


class OrderCreateView(generics.CreateAPIView):
    queryset = Order.objects.all()
    serializer_class = OrderCreateSerializer
    permission_classes = [AllowAny]
    authentication_classes = []


class OrderTrackView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        order_number = request.query_params.get(
            "order_number", ""
        ).strip()
        phone = request.query_params.get("phone", "").strip()

        if not order_number or not phone:
            return Response(
                {
                    "detail": "Order number and phone are required."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        order = (
            Order.objects.filter(
                order_number=order_number,
                customer_phone=phone,
            )
            .prefetch_related("items__product")
            .first()
        )

        if order is None:
            return Response(
                {
                    "detail": "Order not found. Check your details."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(OrderTrackingSerializer(order).data)


class PaymentSubmissionView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = PaymentSubmissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        payment = serializer.save()

        return Response(
            {
                "message": (
                    "Your payment details have been received. "
                    "The seller will verify the transaction."
                ),
                "payment": PaymentResponseSerializer(payment).data,
            },
            status=status.HTTP_201_CREATED,
        )