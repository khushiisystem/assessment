import os
import sys
import django

# Resolve the project root dynamically (assumes script is placed in the same folder as manage.py)
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, PROJECT_ROOT)

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'online_assessment.settings')
django.setup()

from django.conf import settings
from django.db.models import Q
from AI_assessment.models import AIInterviewResponse, CandidateAIAssessment
from AI_assessment.celery_handoff import build_assessment_handoff, celery_system_context
from core.celery_client import get_celery_client

def check_and_regenerate_report(assignment_id):
    try:
        with celery_system_context():
            assignment = CandidateAIAssessment.objects.get(id=assignment_id)
            print(f"Found assessment assignment ID {assignment_id} for candidate: {assignment.candidate.email}")

            responses = AIInterviewResponse.objects.filter(candidate_assessment=assignment).order_by("question_number")
            
            print("\nChecking transcripts and audio recordings in database:")
            for r in responses:
                if r.answer_text and r.answer_text.strip():
                    print(f"  - Q{r.question_number}: Transcript exists. Celery will use the saved text.")
                elif r.audio_recording and r.audio_recording.name:
                    print(f"  - Q{r.question_number}: No transcript, but audio exists ({r.audio_recording.name}). Celery worker will automatically transcribe it.")
                else:
                    print(f"  - Q{r.question_number}: [WARNING] No transcript and no audio recording exists. This question cannot be scored.")

            # Build payload
            print("\nBuilding handoff payload...")
            handoff_payload = build_assessment_handoff(assignment)
            
            # Build callback URL
            callback_base_url = getattr(settings, "CELERY_CALLBACK_BASE_URL", "").strip().rstrip("/")
            if callback_base_url:
                callback_url = f"{callback_base_url}/v1/ai-assessment/celery-callback/"
            else:
                callback_url = f"{settings.SITE_URL.strip().rstrip('/')}/v1/ai-assessment/celery-callback/"
                
            webhook_secret = getattr(settings, "WEBHOOK_SECRET", "")
            if webhook_secret:
                callback_url = f"{callback_url}?secret={webhook_secret}"
            handoff_payload["callback_url"] = callback_url

            print(f"\nTriggering Celery background task...")
            task = get_celery_client().trigger_task(
                "background_tasks.execute_task",
                kwargs={
                    "task_name": "process_ai_assessment_s3_handoff",
                    "payload": handoff_payload,
                },
                queue="assessment",
            )
            print(f"Task successfully triggered! Task ID: {task.get('task_id')}")
            print("The Celery worker will now process the request and update the database.")
    except CandidateAIAssessment.DoesNotExist:
        print(f"Error: CandidateAIAssessment with ID {assignment_id} not found in the database.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python regenerate_report.py <assignment_id>")
        sys.exit(1)
    
    try:
        assignment_id = int(sys.argv[1])
        check_and_regenerate_report(assignment_id)
    except ValueError:
        print("Error: assignment_id must be an integer.")
        sys.exit(1)
