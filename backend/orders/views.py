
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Order
from .serializers import (
    OrderCreateSerializer,
    OrderTrackingSerializer,
)


class OrderCreateView(generics.CreateAPIView):
    queryset = Order.objects.all()
    serializer_class = OrderCreateSerializer
    permission_classes = [AllowAny]

    # This is a public ordering endpoint. Customers do not need
    # a Django session to submit orders, so session-based CSRF
    # authentication checks should not run on this endpoint.
    authentication_classes = []


class OrderTrackView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        order_number = request.query_params.get(
            "order_number", ""
        ).strip()
        phone = request.query_params.get("phone", "").strip()

        if not order_number or not phone:
            return Response(
                {
                    "detail": (
                        "Order number and phone are required."
                    )
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
                    "detail": (
                        "Order not found. Check your details."
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(OrderTrackingSerializer(order).data)
