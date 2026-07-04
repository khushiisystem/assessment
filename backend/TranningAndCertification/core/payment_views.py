"""
Razorpay Payment Gateway Integration for Subscription Plans.

Handles:
- Creating Razorpay orders for plan upgrades
- Verifying payment signatures
- Activating subscriptions upon successful payment
- Webhook handling for async payment events
"""
import hashlib
import hmac
import json
import logging

import razorpay
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import SubscriptionPlan, SubscriptionUsage, UserSubscription

logger = logging.getLogger(__name__)


def _get_razorpay_client():
    """Get configured Razorpay client."""
    return razorpay.Client(
        auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
    )


class CreatePaymentOrderView(APIView):
    """
    POST /v1/api/subscription/create-order/
    Creates a Razorpay order for the selected subscription plan.

    Body: { "plan_id": <int> }
    Returns: { "order_id", "amount", "currency", "key_id", "plan_name" }
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        plan_id = request.data.get("plan_id")

        if not plan_id:
            return Response(
                {"error": "plan_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Allow individual users and org_admin to purchase subscriptions
        if not user.is_individual and user.role != 'org_admin':
            return Response(
                {"error": "Only admins can manage organization subscriptions. Contact your admin."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            plan = SubscriptionPlan.objects.all_for_super_admin().get(id=plan_id, is_active=True)
        except SubscriptionPlan.DoesNotExist:
            return Response(
                {"error": "Invalid or inactive plan."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if plan.plan_type == "free":
            return Response(
                {"error": "Free plan does not require payment."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Amount in paise (INR smallest unit)
        amount_paise = int(float(plan.price) * 100)

        try:
            client = _get_razorpay_client()
            order_data = {
                "amount": amount_paise,
                "currency": "INR",
                "receipt": f"sub_{user.id}_{plan.id}_{int(timezone.now().timestamp())}",
                "notes": {
                    "user_id": str(user.id),
                    "plan_id": str(plan.id),
                    "user_email": user.email,
                    "plan_name": plan.name,
                },
            }
            order = client.order.create(data=order_data)
        except Exception as e:
            logger.error(f"Razorpay order creation failed for user {user.email}: {e}")
            return Response(
                {"error": "Failed to create payment order. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(
            {
                "order_id": order["id"],
                "amount": amount_paise,
                "currency": "INR",
                "key_id": settings.RAZORPAY_KEY_ID,
                "plan_name": plan.name,
                "plan_id": plan.id,
                "user_email": user.email,
                "user_name": user.full_name,
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyPaymentView(APIView):
    """
    POST /v1/api/subscription/verify-payment/
    Verifies Razorpay payment signature and activates the subscription.

    Body: {
        "razorpay_order_id": str,
        "razorpay_payment_id": str,
        "razorpay_signature": str,
        "plan_id": int
    }
    """

    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        from organization.context import set_tenant_context

        user = request.user
        order_id = request.data.get("razorpay_order_id")
        payment_id = request.data.get("razorpay_payment_id")
        signature = request.data.get("razorpay_signature")
        plan_id = request.data.get("plan_id")

        if not all([order_id, payment_id, signature, plan_id]):
            return Response(
                {"error": "Missing required payment verification fields."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verify signature using HMAC SHA256
        message = f"{order_id}|{payment_id}"
        expected_signature = hmac.new(
            settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
            message.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(expected_signature, signature):
            logger.warning(
                f"Payment signature verification failed for user {user.email}, "
                f"order_id={order_id}"
            )
            return Response(
                {"error": "Payment verification failed. Invalid signature."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Fetch the plan
        try:
            plan = SubscriptionPlan.objects.all_for_super_admin().get(id=plan_id, is_active=True)
        except SubscriptionPlan.DoesNotExist:
            return Response(
                {"error": "Plan not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Bypass tenant isolation for subscription operations.
        # UserSubscription and SubscriptionUsage extend TenantModel, so
        # queries through their default manager are filtered by org_id.
        # Subscription data is user-scoped, not org-scoped.
        prev_ctx = {
            "org_id": getattr(user, "organization_id", None),
            "is_super": user.is_superuser or getattr(user, "role", None) == "super_admin",
            "is_individual": getattr(user, "is_individual", False),
        }
        set_tenant_context(None, is_super_admin=True)

        try:
            # Deactivate current subscription
            current_sub = getattr(user, "subscription", None)
            if current_sub:
                current_sub.is_active = False
                current_sub.save(update_fields=["is_active"])

            # Calculate end date
            from dateutil.relativedelta import relativedelta

            now = timezone.now()
            end_date = now + relativedelta(months=plan.duration_months)

            # Create new subscription
            new_sub = UserSubscription.objects.create(
                user=user,
                plan=plan,
                is_active=True,
                end_date=end_date,
            )

            now_month = now.month
            now_year = now.year
            usage, created = SubscriptionUsage.objects.get_or_create(
                user=user,
                month=now_month,
                year=now_year,
                defaults={
                    "subscription": new_sub,
                    "assessments_used": 0,
                    "ai_interviews_used": 0,
                },
            )
            if not created:
                usage.subscription = new_sub
                usage.save(update_fields=["subscription"])

            user.subscription = new_sub
            user.save(update_fields=["subscription"])

        finally:
            set_tenant_context(
                organization_id=prev_ctx["org_id"],
                is_super_admin=prev_ctx["is_super"],
                is_individual=prev_ctx["is_individual"],
            )

        logger.info(
            f"Payment verified: user={user.email}, plan={plan.name}, "
            f"payment_id={payment_id}, order_id={order_id}"
        )

        return Response(
            {
                "message": f"Payment successful! Subscribed to {plan.name}.",
                "subscription": {
                    "id": new_sub.id,
                    "plan_name": plan.name,
                    "plan_type": plan.plan_type,
                    "start_date": new_sub.start_date.isoformat(),
                    "end_date": new_sub.end_date.isoformat(),
                    "is_active": True,
                },
                "payment_id": payment_id,
            },
            status=status.HTTP_200_OK,
        )


class RazorpayWebhookView(APIView):
    """
    POST /v1/api/subscription/webhook/razorpay/
    Handles Razorpay webhook events for async payment notifications.

    Razorpay sends events like payment.captured, payment.failed, etc.
    Webhook secret is used to verify authenticity.
    """

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        # Verify webhook signature
        webhook_secret = settings.RAZORPAY_WEBHOOK_SECRET
        webhook_signature = request.headers.get("X-Razorpay-Signature", "")
        webhook_body = request.body

        if not webhook_signature:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        expected_sig = hmac.new(
            webhook_secret.encode("utf-8"),
            webhook_body,
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(expected_sig, webhook_signature):
            logger.warning("Razorpay webhook signature verification failed")
            return Response(status=status.HTTP_400_BAD_REQUEST)

        try:
            payload = json.loads(webhook_body)
        except (json.JSONDecodeError, ValueError):
            return Response(status=status.HTTP_400_BAD_REQUEST)

        event = payload.get("event", "")
        payment_entity = (
            payload.get("payload", {}).get("payment", {}).get("entity", {})
        )

        if event == "payment.captured":
            self._handle_payment_captured(payment_entity)
        elif event == "payment.failed":
            self._handle_payment_failed(payment_entity)

        return Response({"status": "ok"}, status=status.HTTP_200_OK)

    def _handle_payment_captured(self, payment):
        """Handle successful payment capture."""
        notes = payment.get("notes", {})
        user_id = notes.get("user_id")
        plan_id = notes.get("plan_id")

        if not user_id or not plan_id:
            logger.warning(f"Webhook payment.captured missing notes: {notes}")
            return

        logger.info(
            f"Webhook: payment.captured for user_id={user_id}, plan_id={plan_id}, "
            f"amount={payment.get('amount')}"
        )

    def _handle_payment_failed(self, payment):
        """Handle failed payment."""
        notes = payment.get("notes", {})
        user_email = notes.get("user_email", "unknown")
        logger.warning(
            f"Webhook: payment.failed for user={user_email}, "
            f"reason={payment.get('error_description', 'unknown')}"
        )
