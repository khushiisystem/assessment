"""
Celery Service Client Library
Use this in your Django app to communicate with the standalone Celery service
"""
import os
import sys
import requests
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


PROCESS_INTRO_VIDEO_UPLOAD = "background_tasks.process_intro_video_upload"
PROCESS_ANSWER_RECORDING = "background_tasks.process_answer_recording"
PROCESS_ANSWER_TRANSCRIPTION = "background_tasks.process_answer_transcription"
PROCESS_VIDEO_UPLOAD = "background_tasks.process_video_upload"
GENERATE_ASSESSMENT_REPORT = "background_tasks.generate_assessment_report"
ORCHESTRATE_ASSESSMENT_COMPLETION = "background_tasks.orchestrate_assessment_completion"

TASK_ROUTES = {
    PROCESS_INTRO_VIDEO_UPLOAD: "video_processing",
    PROCESS_ANSWER_RECORDING: "audio_processing",
    PROCESS_ANSWER_TRANSCRIPTION: "audio_processing",
    PROCESS_VIDEO_UPLOAD: "video_processing",
    GENERATE_ASSESSMENT_REPORT: "report_generation",
    ORCHESTRATE_ASSESSMENT_COMPLETION: "assessment",
}


class DirectBrokerCeleryClient:
    """
    Client that publishes task messages directly to the shared Celery broker.

    This is intended for the standalone worker at CELERY_SERVICE_PATH. The web
    app does not import worker task functions; it only sends stable task names.
    """

    def __init__(self, broker_url: str, result_backend: str, service_path: str = ""):
        if service_path and os.path.isdir(service_path) and service_path not in sys.path:
            sys.path.insert(0, service_path)

        from celery import Celery

        self.app = Celery(
            "django_task_publisher",
            broker=broker_url,
            backend=result_backend,
        )
        self.app.conf.update(
            task_serializer="json",
            result_serializer="json",
            accept_content=["json"],
            timezone="UTC",
            enable_utc=True,
            task_routes={task_name: {"queue": queue} for task_name, queue in TASK_ROUTES.items()},
        )

    def _send_task(
        self,
        task_name: str,
        kwargs: Dict[str, Any],
        queue: Optional[str] = None,
        callback_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        # Add callback_url to kwargs if provided
        if callback_url:
            kwargs = dict(kwargs)  # Make a copy
            if task_name == "background_tasks.execute_task" and isinstance(kwargs.get("payload"), dict):
                kwargs["payload"] = dict(kwargs["payload"])
                kwargs["payload"]["callback_url"] = callback_url
            else:
                kwargs["callback_url"] = callback_url

        task = self.app.send_task(
            task_name,
            kwargs=kwargs,
            queue=queue or TASK_ROUTES.get(task_name),
        )
        return {
            "task_id": task.id,
            "status": task.status,
            "task_name": task_name,
            "callback_url": callback_url or None,
        }

    def trigger_task(
        self,
        task_name: str,
        kwargs: Dict[str, Any],
        queue: Optional[str] = None,
        callback_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Publish any whitelisted/discovered Celery task by name."""
        return self._send_task(task_name, kwargs, queue=queue, callback_url=callback_url)

    def health_check(self) -> Dict[str, Any]:
        workers = self.app.control.inspect().active() or {}
        return {
            "status": "healthy" if workers else "no_workers",
            "workers": list(workers.keys()),
        }

    def process_intro_video(self, assignment_id: int, video_data: str, callback_url: Optional[str] = None) -> Dict[str, Any]:
        return self._send_task(
            PROCESS_INTRO_VIDEO_UPLOAD,
            {"assignment_id": assignment_id, "video_data": video_data},
            callback_url=callback_url,
        )

    def process_answer_recording(
        self,
        assignment_id: int,
        question_number: int,
        audio_data: str,
        question_text: str = "",
        question_type: str = "text",
        callback_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        return self._send_task(
            PROCESS_ANSWER_RECORDING,
            {
                "assignment_id": assignment_id,
                "question_number": question_number,
                "audio_data": audio_data,
                "question_text": question_text,
                "question_type": question_type,
            },
            callback_url=callback_url,
        )

    def process_video_upload(
        self,
        assignment_id: int,
        s3_url: Optional[str] = None,
        video_data: Optional[str] = None,
        callback_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload = {"assignment_id": assignment_id, "s3_url": s3_url, "video_data": video_data}
        return self._send_task(
            PROCESS_VIDEO_UPLOAD,
            {key: value for key, value in payload.items() if value is not None},
            callback_url=callback_url,
        )

    def generate_assessment_report(self, assignment_id: int, callback_url: Optional[str] = None) -> Dict[str, Any]:
        return self._send_task(
            GENERATE_ASSESSMENT_REPORT,
            {"assignment_id": assignment_id},
            callback_url=callback_url,
        )

    def orchestrate_assessment_completion(self, assignment_id: int, callback_url: Optional[str] = None) -> Dict[str, Any]:
        return self._send_task(
            ORCHESTRATE_ASSESSMENT_COMPLETION,
            {"assignment_id": assignment_id},
            callback_url=callback_url,
        )

    def get_task_status(self, task_id: str) -> Dict[str, Any]:
        from celery.result import AsyncResult

        result = AsyncResult(task_id, app=self.app)
        response = {
            "task_id": task_id,
            "status": result.status,
            "ready": result.ready(),
            "successful": result.successful() if result.ready() else None,
        }
        if result.ready():
            if result.successful():
                response["result"] = result.result
            else:
                response["error"] = str(result.result)
        return response


class CeleryServiceClient:
    """
    Client for communicating with the standalone Celery service
    """
    
    def __init__(self, base_url: str, api_key: str, timeout: int = 30):
        """
        Initialize the client
        
        Args:
            base_url: Base URL of the Celery service (e.g., http://celery-server:8001)
            api_key: API key for authentication
            timeout: Request timeout in seconds
        """
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.timeout = timeout
        self.headers = {
            "X-API-Key": api_key,
            "Content-Type": "application/json"
        }
    
    def _make_request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Make an HTTP request to the Celery service
        
        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint
            data: Request data (for POST requests)
            
        Returns:
            Response data as dictionary
            
        Raises:
            requests.RequestException: If the request fails
        """
        url = f"{self.base_url}{endpoint}"
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=self.headers, timeout=self.timeout)
            elif method.upper() == "POST":
                response = requests.post(url, headers=self.headers, json=data, timeout=self.timeout)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.Timeout:
            logger.error(f"Request to {url} timed out")
            raise
        except requests.exceptions.ConnectionError:
            logger.error(f"Failed to connect to Celery service at {url}")
            raise
        except requests.exceptions.HTTPError as e:
            logger.error(f"HTTP error from Celery service: {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error communicating with Celery service: {e}")
            raise
    
    def health_check(self) -> Dict[str, Any]:
        """
        Check the health of the Celery service
        
        Returns:
            Health status dictionary
        """
        return self._make_request("GET", "/health")
    
    def process_intro_video(self, assignment_id: int, video_data: str) -> Dict[str, Any]:
        """
        Submit intro video processing task
        
        Args:
            assignment_id: Assignment ID
            video_data: Base64 encoded video data
            
        Returns:
            Task submission response with task_id
        """
        data = {
            "assignment_id": assignment_id,
            "video_data": video_data
        }
        return self._make_request("POST", "/api/v1/tasks/process-intro-video", data)
    
    def process_answer_recording(
        self,
        assignment_id: int,
        question_number: int,
        audio_data: str,
        question_text: str = "",
        question_type: str = "text"
    ) -> Dict[str, Any]:
        """
        Submit answer recording processing task
        
        Args:
            assignment_id: Assignment ID
            question_number: Question number
            audio_data: Base64 encoded audio data
            question_text: Question text (optional)
            question_type: Question type (default: "text")
            
        Returns:
            Task submission response with task_id
        """
        data = {
            "assignment_id": assignment_id,
            "question_number": question_number,
            "audio_data": audio_data,
            "question_text": question_text,
            "question_type": question_type
        }
        return self._make_request("POST", "/api/v1/tasks/process-answer-recording", data)
    
    def process_video_upload(
        self,
        assignment_id: int,
        s3_url: Optional[str] = None,
        video_data: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Submit video upload processing task
        
        Args:
            assignment_id: Assignment ID
            s3_url: S3 URL of the video (optional)
            video_data: Base64 encoded video data (optional)
            
        Returns:
            Task submission response with task_id
        """
        data = {
            "assignment_id": assignment_id,
            "s3_url": s3_url,
            "video_data": video_data
        }
        # Remove None values
        data = {k: v for k, v in data.items() if v is not None}
        return self._make_request("POST", "/api/v1/tasks/process-video-upload", data)
    
    def generate_assessment_report(self, assignment_id: int) -> Dict[str, Any]:
        """
        Submit assessment report generation task
        
        Args:
            assignment_id: Assignment ID
            
        Returns:
            Task submission response with task_id
        """
        data = {"assignment_id": assignment_id}
        return self._make_request("POST", "/api/v1/tasks/generate-assessment-report", data)
    
    def orchestrate_assessment_completion(self, assignment_id: int) -> Dict[str, Any]:
        """
        Submit assessment completion orchestration task
        
        Args:
            assignment_id: Assignment ID
            
        Returns:
            Task submission response with task_id
        """
        data = {"assignment_id": assignment_id}
        return self._make_request("POST", "/api/v1/tasks/orchestrate-assessment-completion", data)
    
    def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """
        Get the status of a task
        
        Args:
            task_id: Celery task ID
            
        Returns:
            Task status information
        """
        return self._make_request("GET", f"/api/v1/tasks/{task_id}/status")

    def trigger_task(
        self,
        task_name: str,
        kwargs: Dict[str, Any],
        queue: Optional[str] = None,
        callback_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Submit any whitelisted/discovered Celery task through the service API."""
        if callback_url:
            kwargs = dict(kwargs)
            if task_name == "background_tasks.execute_task" and isinstance(kwargs.get("payload"), dict):
                kwargs["payload"] = dict(kwargs["payload"])
                kwargs["payload"]["callback_url"] = callback_url
            else:
                kwargs["callback_url"] = callback_url
        data = {
            "task_name": task_name,
            "kwargs": kwargs,
            "queue": queue,
        }
        return self._make_request("POST", "/api/v1/tasks/submit", data)


# Singleton instance for easy use
_client_instance: Optional[CeleryServiceClient] = None


def get_celery_client() -> CeleryServiceClient:
    """
    Get the singleton Celery service client instance
    
    Returns:
        CeleryServiceClient instance
    """
    global _client_instance
    
    if _client_instance is None:
        from django.conf import settings

        publisher = getattr(settings, 'CELERY_SERVICE_PUBLISHER', 'broker').lower()

        if publisher == 'broker':
            broker_url = getattr(settings, 'CELERY_BROKER_URL', 'redis://localhost:6379/0')
            result_backend = getattr(settings, 'CELERY_RESULT_BACKEND', broker_url)
            service_path = getattr(settings, 'CELERY_SERVICE_PATH', '')

            _client_instance = DirectBrokerCeleryClient(
                broker_url=broker_url,
                result_backend=result_backend,
                service_path=service_path,
            )
            return _client_instance
        
        # Get configuration from Django settings
        base_url = getattr(settings, 'CELERY_SERVICE_URL', 'http://localhost:8001')
        api_key = getattr(settings, 'CELERY_SERVICE_API_KEY', '')
        timeout = getattr(settings, 'CELERY_SERVICE_TIMEOUT', 30)
        
        if not api_key:
            raise ValueError("CELERY_SERVICE_API_KEY is not configured in Django settings")
        
        _client_instance = CeleryServiceClient(base_url, api_key, timeout=timeout)
    
    return _client_instance


def reset_celery_client():
    """
    Reset the singleton client instance (useful for testing)
    """
    global _client_instance
    _client_instance = None
