'''import time
from django.utils.deprecation import MiddlewareMixin
from django.urls import resolve
# from new_core.models import UserActivityLog
from core.models import UserActivityLog

# UserActivityLoggingMiddleware has been disabled to reduce database load --- IGNORE ---
class UserActivityLoggingMiddleware(MiddlewareMixin):
    """
    Middleware to automatically log all user activities.
    """

    EXCLUDED_PATHS = [
        "/static/",
        "/media/",
        "/admin/jsi18n/",
        "/favicon.ico",
    ]

    ACTION_TYPE_MAPPING = {
        "login": "login",
        "logout": "logout",
        "take_assessment": "assessment_start",
        "submit_assessment": "assessment_submit",
        "save_answer": "answer_save",
        "run_code": "code_run",
        "proctoring_incident": "proctoring_incident",
        "download": "download",
        "export": "download",
        "import": "upload",
        "upload": "upload",
        "delete": "delete",
        "create": "create",
        "edit": "update",
        "update": "update",
    }

    def process_request(self, request):
        request._activity_log_start_time = time.time()
        return None

    def process_response(self, request, response):
        if any(request.path.startswith(path) for path in self.EXCLUDED_PATHS):
            return response

        if not hasattr(request, "user") or not request.user.is_authenticated:
            return response

        duration_ms = None
        if hasattr(request, "_activity_log_start_time"):
            duration_ms = int((time.time() - request._activity_log_start_time) * 1000)

        action_type = self._determine_action_type(request)
        action_description = self._get_action_description(request)
        ip_address = self._get_client_ip(request)
        user_agent = request.META.get("HTTP_USER_AGENT", "")[:500]
        is_success = 200 <= response.status_code < 400
        extra_data = self._extract_extra_data(request)

        try:
            UserActivityLog.objects.create(
                user=request.user,
                action_type=action_type,
                action_description=action_description,
                url=request.path[:500],
                method=request.method,
                ip_address=ip_address,
                user_agent=user_agent,
                status_code=response.status_code,
                is_success=is_success,
                duration_ms=duration_ms,
                extra_data=extra_data,
            )
        except Exception as exc:
            print(f"Error logging activity: {exc}")

        return response

    def process_exception(self, request, exception):
        if hasattr(request, "user") and request.user.is_authenticated:
            try:
                UserActivityLog.objects.create(
                    user=request.user,
                    action_type="error",
                    action_description=f"Error: {str(exception)[:200]}",
                    url=request.path[:500],
                    method=request.method,
                    ip_address=self._get_client_ip(request),
                    user_agent=request.META.get("HTTP_USER_AGENT", "")[:500],
                    is_success=False,
                    error_message=str(exception)[:1000],
                )
            except Exception as exc:
                print(f"Error logging exception: {exc}")
        return None

    def _determine_action_type(self, request):
        path = request.path.lower()
        for keyword, action_type in self.ACTION_TYPE_MAPPING.items():
            if keyword in path:
                return action_type
        if request.method == "GET":
            return "view"
        if request.method == "POST":
            if "create" in path or "add" in path:
                return "create"
            if "submit" in path:
                return "submit"
            return "create"
        if request.method in ["PUT", "PATCH"]:
            return "update"
        if request.method == "DELETE":
            return "delete"
        return "other"

    def _get_action_description(self, request):
        try:
            resolved = resolve(request.path)
            view_name = resolved.url_name or resolved.view_name
            description = view_name.replace("_", " ").title()
            if request.method != "GET":
                description = f"{request.method} {description}"
            return description[:500]
        except Exception:
            return f"{request.method} {request.path}"[:500]

    def _get_client_ip(self, request):
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            return x_forwarded_for.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR")

    def _extract_extra_data(self, request):
        extra_data = {}
        if request.method == "GET" and request.GET:
            extra_data["query_params"] = dict(request.GET)
        if request.method == "POST" and request.POST:
            sensitive_fields = ["password", "token", "secret", "api_key"]
            post_data = {}
            for key, value in request.POST.items():
                if not any(sensitive in key.lower() for sensitive in sensitive_fields):
                    post_data[key] = value
            if post_data:
                extra_data["form_data"] = post_data
        try:
            resolved = resolve(request.path)
            if resolved.kwargs:
                extra_data["url_params"] = resolved.kwargs
        except Exception:
            pass
        return extra_data or None
'''

