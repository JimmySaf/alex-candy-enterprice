from django.urls import path

from .views import (
    OrderCreateView,
    OrderTrackView,
    PaymentSubmissionView,
)

urlpatterns = [
    path("orders/", OrderCreateView.as_view(), name="order-create"),
    path("orders/track/", OrderTrackView.as_view(), name="order-track"),
    path(
        "orders/payment/",
        PaymentSubmissionView.as_view(),
        name="order-payment-submit",
    ),
]