"""API endpoints for dynamic background task dispatch."""
from __future__ import annotations

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.background_dispatcher import (
    BackgroundTaskError,
    dispatch_background_task,
    list_background_tasks,
)
from core.celery_client import get_celery_client


def _user_role(request) -> str | None:
    return getattr(request.user, "role", None)


class DynamicBackgroundTaskListView(APIView):
    """List background activities available to the current user."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            {
                "status": "success",
                "tasks": list_background_tasks(user_role=_user_role(request)),
            }
        )


class DynamicBackgroundTaskRunView(APIView):
    """Dispatch a background activity by catalog key."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        task_key = request.data.get("task_key")
        payload = request.data.get("payload", {})
        callback_url = request.data.get("callback_url")
        print("----------payload----------")
        print(payload)
        print("----------payload end----------")
        if not task_key:
            return Response(
                {"status": "error", "message": "task_key is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(payload, dict):
            return Response(
                {"status": "error", "message": "payload must be an object."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = dispatch_background_task(
                task_key,
                payload,
                user_role=_user_role(request),
                callback_url=callback_url,
            )
        except BackgroundTaskError as exc:
            return Response(
                {"status": "error", "message": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as exc:  # noqa: BLE001
            return Response(
                {"status": "error", "message": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "status": "submitted",
                "task": result,
            },
            status=status.HTTP_202_ACCEPTED,
        )


class DynamicBackgroundTaskStatusView(APIView):
    """Return status/result for a submitted Celery task id."""

    permission_classes = [IsAuthenticated]

    def get(self, request, task_id):
        try:
            result = get_celery_client().get_task_status(task_id)
        except Exception as exc:  # noqa: BLE001
            return Response(
                {"status": "error", "message": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(result)
