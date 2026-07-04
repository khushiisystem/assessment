import random
import string
import threading
from io import BytesIO
from datetime import datetime
from django.core.mail import send_mail
import requests
from django.conf import settings
from django.core.mail import EmailMessage
from django.http import HttpResponse
from django.template.loader import render_to_string
from django.utils import timezone

# from new_core.models import CandidateAssessment, Question, User
from core.models import CandidateAssessment, Question, User
from django.utils.html import strip_tags
from django.core.mail import EmailMultiAlternatives
import base64
import binascii
import logging
import requests
from django.conf import settings
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from django.utils import timezone
from openpyxl import Workbook

def send_email(subject, recipients, template, context, cc_list=None):
    try:
        html_content = render_to_string(template, context)  # ✔️ string
        text_content = strip_tags(html_content)

        email = EmailMultiAlternatives(
            subject=subject,
            body=text_content,       # ✔️ should be string
            to=recipients,
            cc=cc_list if cc_list else None,
        )
        email.attach_alternative(html_content, "text/html")
        email.send()
        return True
    except Exception as e:
        print("Email error:", e)
        return False




def generate_password(length: int = 10) -> str:
    characters = string.ascii_letters + string.digits
    return "".join(random.choice(characters) for _ in range(length))


def evaluate_answer(question, user_answer):
    if question.question_type in ["mcq_single", "true_false"]:
        return user_answer.strip() == question.correct_answer.strip()
    if question.question_type == "mcq_multiple":
        user_answers = [ans.strip() for ans in user_answer.split(",")]
        correct_answers = [ans.strip() for ans in question.correct_answer.split(",")]
        return set(user_answers) == set(correct_answers)
    if question.question_type == "fill_blank":
        user_answers = [ans.strip().lower() for ans in user_answer.split(",")]
        correct_answers = [ans.strip().lower() for ans in question.correct_answer.split(",")]
        return set(user_answers) == set(correct_answers)
    return None


def format_duration(minutes):
    hours = minutes // 60
    mins = minutes % 60
    return f"{hours:02d}:{mins:02d}"


def get_time_remaining(end_time):
    now = timezone.now()
    if now >= end_time:
        return "00:00:00"
    remaining = end_time - now
    hours, remainder = divmod(remaining.seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


class EmailThread(threading.Thread):
    def __init__(self, email):
        self.email = email
        super().__init__()

    def run(self):
        self.email.send()


    


def send_candidate_credentials(candidate, password):
    """Send login credentials to candidate without using HTML templates"""

    subject = "Your Online Assessment Platform Login Credentials"

    message = (
        f"Hello {candidate.first_name},\n\n"
        f"Your registration is successful!\n\n"
        f"Here are your login details:\n"
        f"email: {candidate.email}\n"
        f"Password: {password}\n\n"
        f"Login here: {getattr(settings, 'SITE_URL', '')}\n\n"
        "Please change your password after logging in.\n\n"
        "Thanks!"
    )

    try:
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [candidate.email],
            fail_silently=False,
        )
        return True
    except Exception as e:
        print(f"Error sending credentials email: {e}")
        return False


def send_assignment_notification(candidate_assessment):
    """
    Send a plain-text notification email to the candidate when an assessment is assigned.
    Does not use any HTML templates.
    """
    # basic validation
    if not getattr(candidate_assessment, "candidate", None) or not getattr(candidate_assessment, "assessment", None):
        return False

    candidate = candidate_assessment.candidate
    assessment = candidate_assessment.assessment
    recipient = getattr(candidate, "email", None)
    if not recipient:
        return False

    subject = f"New Assessment Assigned: {assessment.title}"
    site_url = getattr(settings, "SITE_URL", "").rstrip("/")
    assessment_link = f"{site_url}/candidate/my-assessment/{candidate_assessment.id}/running"

    template = "emails/assessment_assigned.html"

    context = {
        "candidate": candidate,
        "assessment": assessment,
        "start_date": assessment.start_date,
        "end_date": assessment.end_date,
        "login_url": settings.SITE_URL,
        "assessment_link": assessment_link,
}

    return send_email(
       subject,
       [recipient],
       template,
       context
)


def check_subscription_limits(user, resource_type):
    """
    Check subscription limits for a user without raising if subscriptions are
    unavailable.

    Returns:
        (allowed: bool, message: str)
    """
    if  getattr(user, "is_individual", False):
        return True, ""

    try:
        from core.models import SubscriptionUsage
    except Exception:
        return True, ""

    sub = getattr(user, "subscription", None)
    if not sub or not sub.is_active:
        return False, "No active subscription. Please subscribe to continue."

    if not sub.is_valid():
        return False, "Your subscription has expired. Please renew to continue."

    now = timezone.now()
    usage, created = SubscriptionUsage.objects.get_or_create(
        user=user,
        month=now.month,
        year=now.year,
        defaults={
            "subscription": sub,
            "assessments_used": 0,
            "ai_interviews_used": 0,
        },
    )
    if not created and usage.subscription != sub:
        usage.subscription = sub
        usage.save(update_fields=["subscription"])

    plan = sub.plan
    if resource_type == "assessment":
        if usage.assessments_used >= plan.assessments_per_month:
            return False, (
                f"Monthly assessment limit reached ({plan.assessments_per_month}). "
                f"Upgrade your plan for more assessments."
            )
        if plan.plan_type == "free" and usage.assessments_used >= plan.free_assessments_per_week:
            return False, (
                f"Weekly free assessment limit reached ({plan.free_assessments_per_week}). "
                f"Upgrade to a paid plan for more."
            )
    elif resource_type == "ai_interview":
        if usage.ai_interviews_used >= plan.ai_interviews_per_month:
            return False, (
                f"Monthly AI interview limit reached ({plan.ai_interviews_per_month}). "
                f"Upgrade your plan for more."
            )
        if plan.plan_type == "free" and usage.ai_interviews_used >= plan.free_ai_assessments_per_week:
            return False, (
                f"Weekly free AI interview limit reached ({plan.free_ai_assessments_per_week}). "
                f"Upgrade to a paid plan for more."
            )

    return True, ""

    # message_lines = [
    #     f"Hello {getattr(candidate, 'first_name', '') or getattr(candidate, 'username', '')},",
    #     "",
    #     f"You have been assigned a new assessment: {assessment.title}",
    #     f"Start: {getattr(assessment, 'start_date', 'N/A')}",
    #     f"End:   {getattr(assessment, 'end_date', 'N/A')}",
    #     "",
    #     f"Start Assessment: {assessment_link}",   
    #     "",
    #     "Please complete the assessment within the given window.",
    #     "",
    #     "Regards,",
    #     "Assessment Team",
    # ]
    # message = "\n".join(str(line) for line in message_lines)

    # try:
    #     # DEFAULT_FROM_EMAIL must be set in settings; send_mail is synchronous
    #     send_mail(subject, message, getattr(settings, "DEFAULT_FROM_EMAIL", None), [recipient], fail_silently=False)
    #     return True
    # except Exception:
    #     # Return False on failure; consider logging the exception if needed
    #     return False



def send_assessment_completion_email(candidate_assessment):
    subject = f"Assessment Completed: {candidate_assessment.assessment.title}"
    template = "emails/assessment_completed.html"

    candidate_email = (candidate_assessment.candidate.email or "").strip()
    cc_recipients = []
    if candidate_email.lower().endswith("@zecdata.com"):
        cc_recipients = ["abhishek@zecdata.com", "prashant.t@zecdata.com"]

    candidate_context = {
        "candidate": candidate_assessment.candidate,
        "assessment": candidate_assessment.assessment,
        "score": candidate_assessment.score,
        "total_marks": candidate_assessment.total_marks,
        "percentage": candidate_assessment.percentage,
        "end_time": candidate_assessment.end_time,
        "SITE_URL": settings.SITE_URL,
    }
    candidate_sent = send_email(
        subject,
        [candidate_assessment.candidate.email],
        template,
        candidate_context,
        cc_list=cc_recipients or None,
    )

    admin_subject = f"Candidate Completed Assessment: {candidate_assessment.assessment.title}"
    admin_template = "emails/admin_assessment_completed.html"
    admin_context = {
        "candidate": candidate_assessment.candidate,
        "assessment": candidate_assessment.assessment,
        "score": candidate_assessment.score,
        "total_marks": candidate_assessment.total_marks,
        "percentage": candidate_assessment.percentage,
        "end_time": candidate_assessment.end_time, 
        "SITE_URL": settings.SITE_URL,
    }
    admin_email = candidate_assessment.assigned_by.email
    admin_sent = send_email(
        admin_subject,
        [admin_email],
        admin_template,
        admin_context,
        cc_list=cc_recipients or None,
    )

    return candidate_sent and admin_sent


def send_cheating_alert_email(proctoring_incident):
    subject = f"⚠️ Cheating Alert: {proctoring_incident.get_incident_type_display()}"
    template = "emails/cheating_alert.html"

    context = {
        "candidate": proctoring_incident.candidate,
        "assessment": proctoring_incident.assessment,
        "incident_type": proctoring_incident.get_incident_type_display(),
        "details": proctoring_incident.details,
        "timestamp": proctoring_incident.timestamp,
        "severity": proctoring_incident.get_severity_display(),
    }

    candidate_sent = send_email(subject, [proctoring_incident.candidate.email], template, context)

    try:
        ca = CandidateAssessment.objects.get(
            candidate=proctoring_incident.candidate,
            assessment=proctoring_incident.assessment,
        )
        admin_email = ca.assigned_by.email
        admin_sent = send_email(subject, [admin_email], template, context)
    except CandidateAssessment.DoesNotExist:
        admin_sent = False

    proctoring_incident.email_sent = True
    proctoring_incident.save()

    return candidate_sent or admin_sent


def _write_rows_to_workbook(sheet_name, rows, headers):
    output = BytesIO()
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = sheet_name
    worksheet.append(headers)
    for row in rows:
        worksheet.append([row.get(header, "") for header in headers])
    workbook.save(output)
    output.seek(0)
    return output



def export_candidates_to_excel():
    candidates = User.objects.filter(role="candidate").values(
        "username", "email", "first_name", "last_name", "phone", "date_joined"
    )
    rows = []
    for candidate in candidates:
        candidate = dict(candidate)
        date_joined = candidate.get("date_joined")
        if isinstance(date_joined, datetime) and date_joined.tzinfo is not None:
            candidate["date_joined"] = date_joined.replace(tzinfo=None)
        rows.append(candidate)
    headers = ["username", "email", "first_name", "last_name", "phone", "date_joined"]
    return _write_rows_to_workbook("Candidates", rows, headers)


def export_questions_to_excel():
    questions = Question.objects.all().values(
        "title",
        "question_type",
        "category__name",
        "difficulty",
        "marks",
        "description",
        "option1",
        "option2",
        "option3",
        "option4",
        "correct_answer",
        "tags",
    )
    rows = [dict(question) for question in questions]
    headers = [
        "title",
        "question_type",
        "category__name",
        "difficulty",
        "marks",
        "description",
        "option1",
        "option2",
        "option3",
        "option4",
        "correct_answer",
        "tags",
    ]
    return _write_rows_to_workbook("Questions", rows, headers)


def export_results_to_excel(assessment_id):
    results = CandidateAssessment.objects.filter(
        assessment_id=assessment_id, status="completed"
    ).select_related("candidate").values(
        "candidate__username",
        "candidate__email",
        "candidate__first_name",
        "candidate__last_name",
        "score",
        "total_marks",
        "percentage",
        "start_time",
        "end_time",
    )
    rows = []
    for result in results:
        result = dict(result)
        for key in ("start_time", "end_time"):
            value = result.get(key)
            if isinstance(value, datetime) and value.tzinfo is not None:
                result[key] = value.replace(tzinfo=None)
        rows.append(result)
    headers = [
        "candidate__username",
        "candidate__email",
        "candidate__first_name",
        "candidate__last_name",
        "score",
        "total_marks",
        "percentage",
        "start_time",
        "end_time",
    ]
    return _write_rows_to_workbook("Results", rows, headers)

logger = logging.getLogger(__name__)
# Judge0 Helpers
MAX_OUTPUT_SIZE = 10000

def truncate_output(value, limit=MAX_OUTPUT_SIZE):
    """
    Prevent massive payloads from freezing frontend.
    """
    if not value:
        return ""
    value = str(value)

    if len(value) > limit:
        return (
            value[:limit]
            + "\n\n[Output truncated]"
        )
    return value

def encode_base64_field(value):
    """
    Encode request payload for Judge0 when base64_encoded=true.
    """
    if value is None:
        return ""
    if not isinstance(value, str):
        value = str(value)
    return base64.b64encode(
        value.encode("utf-8")
    ).decode("utf-8")


def decode_base64_field(value):
    """
    Safely decode Judge0 base64 fields.
    Works across all languages.
    """
    if not value:
        return ""
    if not isinstance(value, str):
        return str(value)
    try:
        cleaned = (value.strip().replace("\n", "").replace("\r", "") )
        # validate base64 first
        decoded = base64.b64decode(cleaned, validate=True)

        return decoded.decode(
            "utf-8",
            errors="replace"
        )
    except (binascii.Error, ValueError,UnicodeDecodeError,):
        # Already plain text
        return value
    except Exception:
        return value

def get_retry_session():
    """
    Retry transient Judge0 failures.
    """
    retry_strategy = Retry(
        total=1,        
        backoff_factor=0.2,
        status_forcelist=[
            429,
            500,
            502,
            503,
            504,
        ],
        allowed_methods=None,
    )
    adapter = HTTPAdapter(
        max_retries=retry_strategy
    )
    session = requests.Session()
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session

# Judge0 Execution
def execute_code_with_judge0(code,language,stdin=""):
    """
    Execute code using Judge0 API.
    """
    normalized_language = (language.strip().lower())
    logger.info("Executing Judge0 code language=%s",normalized_language)

    # Validate language
    if (
        normalized_language
        not in settings.JUDGE0_LANGUAGE_MAPPING
    ):
        logger.warning("Unsupported language received: %s",language)
        return {
            "status": "Error",
            "stderr": (f"Unsupported language: " f"{language}"),
            "compile_output": "",
            "stdout": "",
        }

    language_id = (
        settings.JUDGE0_LANGUAGE_MAPPING[
            normalized_language
        ]
    )

    logger.info("Judge0 language_id=%s",language_id)

    # Encode request payload
    submission_data = {
        "source_code": encode_base64_field(code),
        "language_id": language_id,
        "stdin": encode_base64_field(stdin),
        "cpu_time_limit": 5,
        "memory_limit": 128000,
    }
    try:
        base_url = getattr(settings, "JUDGE0_API_URL", "https://ce.judge0.com").rstrip("/")
        submission_url = (f"{base_url}/submissions" f"?base64_encoded=true" f"&wait=true" f"&fields=*" )
        logger.info("Submitting code to Judge0")
        session = get_retry_session()
        response = session.post(
            submission_url,
            json=submission_data,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            timeout=(10,60),
        )

        # HTTP error
        if response.status_code not in (200, 201):
            logger.error("Judge0 HTTP error " "status=%s body=%s",
                response.status_code,response.text[:500],
            )
            return {
                "status": "Error",
                "stdout": "",
                "stderr": truncate_output( response.text[:1000] or"Judge0 service unavailable"),
                "compile_output": "",
            }
        try:
            result_data = response.json()
        except ValueError:
            logger.error(
                "Failed to parse Judge0 response as JSON"
            )

            return {
                "status": "Error",
                "stdout": "",
                "stderr": "Failed to parse Judge0 response",
                "compile_output": "",
            }

        logger.debug(
            "FULL JUDGE0 RESPONSE: %s",
            result_data
        )

        return format_judge0_result(
            result_data
        )

    # Timeout
    except requests.exceptions.Timeout:
        logger.warning("Judge0 request timeout")
        return {
            "status":"Time Limit Exceeded",
            "stdout": "",
            "stderr":"Execution timeout exceeded",
            "compile_output": "",
        }
    
    # Network errors
    except requests.exceptions.RequestException as exc:
        logger.exception("Judge0 network error")
        return {
            "status": "Error",
            "stdout": "",
            "stderr": truncate_output( str(exc)),
            "compile_output": "",
        }

    # Unexpected errors
    except Exception as exc:
        logger.exception("Unexpected Judge0 error")
        return {
            "status": "Error",
            "stdout": "",
            "stderr": truncate_output( str(exc)),
            "compile_output": "",
        }


# Judge0 Response Formatter
def format_judge0_result(result_data):
    """
    Normalize Judge0 response safely.
    """
    status_info = (
        result_data.get("status", {})
    )
    status_id = status_info.get("id")
    status_description = (
        status_info.get(
            "description",
            "Unknown"
        )
    )
    status_mapping = {
        3: "Accepted",
        4: "Wrong Answer",
        5: "Time Limit Exceeded",
        6: "Compilation Error",
        7: "Runtime Error",
        8: "Memory Limit Exceeded",
        9: "Internal Error",
        10: "Exec Format Error",
        11:"Segmentation Fault",
        12:"Floating Point Exception",
    }

    if status_id is None:
        status = "Error"
    else:
        status = status_mapping.get(
            status_id,
            status_description
        )

    # Decode Judge0 base64 fields
    stdout = decode_base64_field(
        result_data.get("stdout")
    )

    stderr = decode_base64_field(
        result_data.get("stderr")
    )

    compile_output = decode_base64_field(
        result_data.get("compile_output")
    )

    message = decode_base64_field(
        result_data.get("message")
    )

    # Normalize outputs
    stdout = truncate_output(
        stdout.replace("\r\n", "\n")
    )

    stderr = truncate_output(
        stderr.replace("\r\n", "\n")
    )

    compile_output = truncate_output(
        compile_output.replace(
            "\r\n",
            "\n"
        )
    )

    message = truncate_output(
        message.replace("\r\n", "\n")
    )

    # Fallback error propagation
    final_error = (
        stderr
        or message
        or status_description
    )

    return {
        "status": status,
        "time": result_data.get("time"),
        "memory": result_data.get("memory"),
        "stdout":stdout,

        # Runtime-related errors
        "stderr":
        (
            stderr
            if stderr
            else final_error
        ),

        # Compilation-only errors
        "compile_output":
        compile_output,

        "exit_code":
        result_data.get(
            "exit_code"
        ),

        "exit_signal":
        result_data.get(
            "exit_signal"
        ),

        "judge0_status":
        status_description,
    }

