"""
Generic background task dispatcher.

Views call this module with a short activity key.  The dispatcher validates the
payload against the whitelist and publishes the matching Celery task through
the configured Celery client.
"""
from __future__ import annotations

from typing import Any, Dict, Iterable, Optional

from .celery_client import get_celery_client
from .task_catalog import BACKGROUND_TASK_CATALOG


class BackgroundTaskError(ValueError):
    """Raised when a background task request is not valid."""


def list_background_tasks(user_role: Optional[str] = None) -> list[Dict[str, Any]]:
    """Return catalog entries visible to the supplied role."""
    tasks = []
    for key, config in BACKGROUND_TASK_CATALOG.items():
        allowed_roles = config.get("allowed_roles", [])
        if user_role and allowed_roles and user_role not in allowed_roles:
            continue
        tasks.append(
            {
                "key": key,
                "label": config["label"],
                "description": config.get("description", ""),
                "required_fields": config.get("required_fields", []),
                "optional_fields": config.get("optional_fields", []),
                "queue": config.get("queue"),
            }
        )
    return tasks


def validate_background_task_request(
    task_key: str,
    payload: Dict[str, Any],
    user_role: Optional[str] = None,
) -> Dict[str, Any]:
    """Resolve and validate a task catalog entry."""
    config = BACKGROUND_TASK_CATALOG.get(task_key)
    if not config:
        raise BackgroundTaskError(f"Unknown background task '{task_key}'.")

    allowed_roles: Iterable[str] = config.get("allowed_roles", [])
    if user_role and allowed_roles and user_role not in allowed_roles:
        raise BackgroundTaskError(f"Role '{user_role}' cannot run background task '{task_key}'.")

    required_fields = config.get("required_fields", [])
    missing = [field for field in required_fields if field not in payload]
    if missing:
        raise BackgroundTaskError(f"Missing required field(s): {', '.join(missing)}.")

    return config


def dispatch_background_task(
    task_key: str,
    payload: Dict[str, Any],
    user_role: Optional[str] = None,
    callback_url: Optional[str] = None,
) -> Dict[str, Any]:
    """Validate and publish a whitelisted background task."""
    print("Running dispatch_background_task()")
    print("----------dispatch_background_task payload----------")
    print(payload)
    print("----------dispatch_background_task payload end----------")
    print(callback_url)
    config = validate_background_task_request(task_key, payload, user_role=user_role)
    result = get_celery_client().trigger_task(
        config["task_name"],
        kwargs=payload,
        queue=config.get("queue"),
        callback_url=callback_url,
    )
    result["task_key"] = task_key
    print("background_task assigend successfully ----------")
    return result

