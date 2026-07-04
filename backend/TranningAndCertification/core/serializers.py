from __future__ import annotations

import logging
from django.utils import timezone
from typing import List, Optional
from learning.models import Completion

from django.contrib.auth import get_user_model
from django.core.validators import RegexValidator
from django.db.models import Sum
from django.db import transaction
from rest_framework import serializers
import os

from core.models import (
    Assessment,
    AssessmentQuestion,
    CandidateAssessment,
    Category,
    OTPVerification,
    ProctoringIncident,
    Question,
    Response,
    SQLDataset,
    SQLQuestion,
    SQLTestCase,
    TestCase
)
from core.utils import generate_password
from learning.models import Assignment

logger = logging.getLogger(__name__)

class CandidateRegistrationSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=30)
    last_name = serializers.CharField(max_length=30)
    email = serializers.EmailField()
    phone = serializers.CharField(
        max_length=10,
        min_length=10,
        validators=[
            RegexValidator(regex=r"^\d{10}$", message="Enter a valid 10-digit phone number.")
        ],
    )
    resume = serializers.FileField()
    profile = serializers.CharField(required=False, allow_blank=True)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("This email is already registered.")
        return value.lower()

    def validate_phone(self, value):
        if User.objects.filter(phone=value).exists():
            raise serializers.ValidationError("This phone number is already registered.")
        return value

    def validate_resume(self, value):
        ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx"]
        ALLOWED_TYPES = [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ]

        ext = os.path.splitext(value.name.lower())[1]
        if ext not in ALLOWED_EXTENSIONS:
            raise serializers.ValidationError("Only PDF, DOC, DOCX files are allowed.")
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("Resume file size must be under 5 MB.")
        if value.content_type not in ALLOWED_TYPES:
            raise serializers.ValidationError("Invalid file type.")
        return value



class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'description']



class OTPVerificationSerializer(serializers.Serializer):
    otp_code = serializers.CharField(
        max_length=6,
        min_length=6,
        validators=[RegexValidator(regex=r"^\d{6}$", message="Enter a valid 6-digit OTP.")],
    )

User = get_user_model()


MCQ_OPTION_LABELS = [
    ("A", "option1"),
    ("B", "option2"),
    ("C", "option3"),
    ("D", "option4"),
    ("E", "option5"),
]


def _build_option_lookup(question: Question) -> dict:
    lookup = {}
    for index, (label, attr) in enumerate(MCQ_OPTION_LABELS, start=1):
        option_text = getattr(question, attr, "") or ""
        if not option_text:
            continue
        lookup[label] = option_text
        lookup[label.lower()] = option_text
        key_numeric = str(index)
        lookup[key_numeric] = option_text
        lookup[f"option{index}"] = option_text
        lookup[f"option_{index}"] = option_text
    return lookup


def _humanize_mcq_answer(question: Question, raw_answer: Optional[str]) -> str:
    if not raw_answer:
        return ""
    lookup = _build_option_lookup(question)
    values = [value.strip() for value in str(raw_answer).split(",") if value and value.strip()]
    humanized = []
    for value in values:
        option_text = (
            lookup.get(value)
            or lookup.get(value.upper())
            or lookup.get(value.lower())
        )
        humanized.append(option_text or value)
    return ", ".join(humanized)


class SQLTestCaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = SQLTestCase
        fields = ["id", "setup_sql", "points", "is_hidden", "created_at"]



class CandidateSerializer(serializers.ModelSerializer):
    learning_assignments = serializers.SerializerMethodField()
    assessment_assignments = serializers.SerializerMethodField()  # <-- NEW FIELD
    avatar = serializers.SerializerMethodField()  # Return presigned URL
    projects = serializers.JSONField(default=list)
    organization_id = serializers.IntegerField(read_only=True)
    organization_name = serializers.CharField(source="organization.name", read_only=True, default=None)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "phone",
            "profile",
            "role",
            "date_joined",
            "last_login",
            "is_active",
            "resume_s3_url",
            "avatar",
            "professional_summary",
            "tech_stack",
            "services_worked_on",
            "payment_methods_used",
            "projects",
            "is_individual",
            "organization_id",
            "organization_name",
            "learning_assignments",
            "assessment_assignments",   # <-- ADD HERE
        ]
        read_only_fields = [
            "id",
            "username",
            "role",
            "is_individual",
            "date_joined",
            "last_login",
            "is_active",
            "resume_s3_url",
            "avatar",
            "learning_assignments",
            "assessment_assignments",
            "projects"
        ]

    def get_learning_assignments(self, obj):
        from learning.models import UserTechnologyProgress
        
        # Bypass tenant isolation and fetch all assignments for this specific user
        assignments_qs = Assignment.objects.all_for_super_admin().filter(user=obj).select_related("technology")

        # Get progress of all technologies for this user
        progress_qs = UserTechnologyProgress.objects.all_for_super_admin().filter(user=obj)
        progress_map = {
            str(p.technology.id): {
                "progress": p.progress,
                "completed": p.completed,
                "total": p.total,
                "user_notes": p.user_notes 
            }
            for p in progress_qs
        }

        data = []
        for assignment in assignments_qs:
            technology = assignment.technology  # direct access (safe)
            tech_id = str(technology.id)
          
            
            # Get progress for this technology, default to 0% if not found
            progress_data = progress_map.get(tech_id, {
                "progress": 0,
                "completed": 0,
                "total": 0,
                "user_notes": None
            })
            user_notes = progress_data["user_notes"]
            last_completion = None
            if technology:
                       # Bypass tenant isolation to get the latest completion for this user
                       last_completion = Completion.objects.all_for_super_admin().filter(
                           user=obj,
                            question__technology=technology
                        ).order_by("-completed_at").first()
                       
            if user_notes:
                # If user_notes is a list of strings, return the first one
                if isinstance(user_notes, str) and user_notes.startswith('['):  # if it's a string representation of a list
                    import ast
                    user_notes = ast.literal_eval(user_notes)  # Convert string to list

                if isinstance(user_notes, list) and user_notes:
                    # Get the first URL from the list of dictionaries
                    user_notes = user_notes[0].get('url') if isinstance(user_notes[0], dict) else user_notes[0]
                else:
                    user_notes = None
            data.append({
                    "assignment_id": assignment.id,
                    "technology_id": tech_id,
                    "technology_name": technology.name if technology else None,
                    "assigned_at": assignment.assigned_at,
                    "due_at": assignment.due_at,
                    "assigned_by": assignment.assigned_by.id,  # 🔥 ADD THIS LINE
                    "is_self_unlocked": assignment.assigned_by == obj,  # 🔥 OPTIONAL
                    "notes": assignment.notes,
                    "progress": progress_data["progress"],
                    "completed": progress_data["completed"],
                    "total": progress_data["total"],
                    "user_notes": user_notes,
                    "last_active": timezone.localtime(last_completion.completed_at).isoformat() if last_completion else None
                })
        return data
    # NEW — ASSESSMENT LIST FOR EACH CANDIDATE
    def get_assessment_assignments(self, obj):
        from core.models import CandidateAssessment

        qs = CandidateAssessment.objects.all_for_super_admin().filter(candidate=obj).select_related("assessment")

        data = []
        for a in qs:
            assessment = a.assessment
            total_marks = a.total_marks or assessment.questions.aggregate(total=Sum("marks")).get("total") or 0
            
            data.append({
                "candidate_assessment_id": a.id,
                "assessment_id": assessment.id,
                "title": assessment.title,
                "assigned_at": a.assigned_date,
                "status": a.status if hasattr(a, 'status') else None,
                "score": float(a.score) if getattr(a, "score", None) else 0.0,
                "total_marks": float(total_marks),
                "start_date": assessment.start_date,
                "end_date": assessment.end_date,
               "total_marks": float(total_marks),
               "percentage": round((float(a.score) / float(total_marks)) * 100, 2) if (getattr(a, "score", None) and total_marks) else 0.00,
            })

        return data

    def get_avatar(self, obj):
        """Generate presigned URL for avatar if available"""
        if not obj.avatar:
            return None
        
        try:
            logger.info("Generating presigned URL for avatar", extra={
                "user_id": obj.id if hasattr(obj, 'id') else None
            })
            import re
            from urllib.parse import urlparse
            import boto3
            from django.conf import settings
            
            parsed = urlparse(obj.avatar)
            # Extract bucket name and region from URL: https://bucket.s3.region.amazonaws.com/key
            hostname = parsed.hostname or ""
            match = re.match(r"^(.+)\.s3[.-]([a-z0-9-]+)\.amazonaws\.com$", hostname)
            if match:
                bucket_name = match.group(1)
                region_name = match.group(2)
            else:
                bucket_name = getattr(settings, "AWS_STORAGE_BUCKET_NAME", None)
                region_name = getattr(settings, "AWS_S3_REGION_NAME", "ap-south-1")
            s3_key = parsed.path.lstrip("/")

            s3_client = boto3.client(
                "s3",
                aws_access_key_id=getattr(settings, "AWS_ACCESS_KEY_ID", None),
                aws_secret_access_key=getattr(settings, "AWS_SECRET_ACCESS_KEY", None),
                region_name=region_name,
            )

            presigned_url = s3_client.generate_presigned_url(
                "get_object",
                Params={
                    "Bucket": bucket_name,
                    "Key": s3_key,
                },
                ExpiresIn=300,  # 5 minutes
            )

            return presigned_url
        except Exception as e:
            logger.exception("Error generating avatar presigned URL", extra={
                "user_id": obj.id if hasattr(obj, 'id') else None,
                "avatar_url": str(obj.avatar)[:50] if obj.avatar else None
            })
            return obj.avatar  # Fallback to original URL


class CandidateCreateSerializer(serializers.ModelSerializer):
    resume = serializers.FileField(required=False, write_only=True)
    avatar = serializers.FileField(required=False, write_only=True)
    password = serializers.CharField(write_only=True, required=False, min_length=8)


    first_name = serializers.CharField(required=True)
    phone = serializers.CharField(required=True)
    profile = serializers.CharField(required=True)
    
    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "first_name",
            "last_name",
            "phone",
            "profile",
            "avatar",
            "resume",
            "password",
        ]

    def validate_email(self, value: str) -> str:
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Email already registered.")
        return value.lower()

    def validate_phone(self, value: str) -> str:
        if not value.isdigit() or len(value) != 10:
            raise serializers.ValidationError("Enter a valid 10-digit phone number.")
        if User.objects.filter(phone=value).exists():
            raise serializers.ValidationError("Phone already registered.")
        return value

    def create(self, validated_data):
        logger.info("Create candidate attempt", extra={
            "email": validated_data.get("email"),
            "username_provided": validated_data.get("username")
        })
        validated_data.pop("resume", None)
        avatar_file = validated_data.pop("avatar", None)
        password = validated_data.pop("password", None) or generate_password()
        # username = validated_data["email"].split("@")[0]
        username = validated_data.pop("username")
        username_counter = 1
        base_username = username
        while User.objects.filter(username=username).exists():
            username = f"{base_username}{username_counter}"
            username_counter += 1

        user = User.objects.create_user(
            username=username,
            email=validated_data["email"],
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
            phone=validated_data.get("phone", ""),
            profile=validated_data.get("profile", ""),
            role="candidate",
            password=password,
            organization=validated_data.get("organization"),
            created_by=validated_data.get("created_by"),
        )
        logger.info("Candidate user created successfully", extra={
            "user_id": user.id,
            "email": user.email,
            "username": user.username
        })
        # Handle avatar upload to S3 if provided
        if avatar_file:
            try:
                from .storage_utils import s3_handler
                avatar_url = s3_handler.upload_avatar(avatar_file, user.email)
                if avatar_url:
                    user.avatar = avatar_url
                    user.save(update_fields=['avatar'])
                    logger.info("Avatar uploaded successfully for new candidate", extra={
                        "user_id": user.id,
                        "email": user.email,
                        "username": user.username
                    })
            except Exception as e:
                logger.exception("Error uploading avatar to S3 for new candidate", extra={
                    "email": user.email,
                    "username": user.username
                })
        user._raw_password = password  # type: ignore[attr-defined]
        return user


class CandidateQuickAssignSerializer(serializers.Serializer):
    selection = serializers.CharField(required=False)
    assessment_id = serializers.CharField(required=False)
    ai_assessment_id = serializers.CharField(required=False)

    def validate(self, attrs):
        if attrs.get("selection") or attrs.get("assessment_id") or attrs.get("ai_assessment_id"):
            return attrs
        raise serializers.ValidationError(
            "Provide selection token or assessment identifiers."
        )


class CandidateBulkDeleteSerializer(serializers.Serializer):
    candidate_ids = serializers.ListField(
        child=serializers.IntegerField(), allow_empty=False
    )


class AssessmentBulkDeleteSerializer(serializers.Serializer):
    assessment_ids = serializers.ListField(
        child=serializers.IntegerField(), allow_empty=False
    )


class CandidateImportSerializer(serializers.Serializer):
    file = serializers.FileField()
    file_type = serializers.ChoiceField(choices=("csv", "xlsx"))

class QuestionSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)

    # extra
    testcases = serializers.SerializerMethodField()
    sql_details = serializers.SerializerMethodField()

    class Meta:
        model = Question
        exclude = []   # you can keep this as it is

    def get_testcases(self, obj):
        if obj.question_type == "coding":
            return TestCaseSerializer(obj.testcases.all(), many=True).data
        return []  # other questions -> empty

    def get_sql_details(self, obj):
        if obj.question_type == "sql":
            try:
                return SQLQuestionSerializer(obj.sqlmeta).data
            except SQLQuestion.DoesNotExist:
                return None
        return None

class SQLQuestionSerializer(serializers.ModelSerializer):
    dataset_name = serializers.CharField(source="dataset.name", read_only=True)
    dataset_engine = serializers.CharField(source="dataset.engine", read_only=True)
    sql_testcases = SQLTestCaseSerializer(many=True, read_only=True)

    class Meta:
        model = SQLQuestion
        fields = [
            "dataset",
            "dataset_name",
            "dataset_engine",
            "reference_solution",
            "strict_column_order",
            "float_tolerance",
            "max_rows",
            "sql_testcases"
        ]


class QuestionCreateSerializer(serializers.ModelSerializer):
    dataset_id = serializers.IntegerField(required=False)
    max_rows = serializers.IntegerField(required=False, default=5000)
    testcases = serializers.ListField(
        child=serializers.DictField(),  # each testcase: {"input_data": "...", "expected_output": "...", "points": 1.0, "is_hidden": true}
        required=False
    )

    class Meta:
        model = Question
        exclude = ["created_by"]

    def validate(self, attrs):
        qtype = attrs.get("question_type")
        logger.info("Question validation started", extra={
            "question_type": qtype,
            "title": attrs.get("title", "")
        })

        # MCQ validation
        if qtype in {"mcq_single", "mcq_multiple", "true_false"}:
            options = [attrs.get(f"option{i}") for i in range(1, 5)]
            if not options[0] or not options[1]:
                logger.warning("Question validation failed - missing MCQ options", extra={
                    "question_type": qtype,
                    "options_provided": sum(1 for opt in options if opt)
                })
                raise serializers.ValidationError("Options 1 and 2 are required.")

            correct = attrs.get("correct_answer")
            if not correct:
                logger.warning("Question validation failed - missing correct answer", extra={
                    "question_type": qtype
                })
                raise serializers.ValidationError("Correct answer is required.")

            if qtype == "mcq_multiple":
                if isinstance(correct, str):
                    attrs["correct_answer"] = [c.strip() for c in correct.split(",")]
                elif not isinstance(correct, list):
                    logger.warning("Question validation failed - invalid correct_answer format", extra={
                        "question_type": qtype,
                        "correct_answer_type": type(correct).__name__
                    })
                    raise serializers.ValidationError("correct_answer must be a list for mcq_multiple.")

        # SQL question validation
        if qtype == "sql" and not attrs.get("dataset_id"):
            logger.warning("Question validation failed - missing SQL dataset", extra={
                "question_type": qtype
            })
            raise serializers.ValidationError("dataset_id is required for SQL questions.")

        # Coding question validation
        if qtype == "coding":
            testcases = attrs.get("testcases")
            if not testcases or not isinstance(testcases, list) or len(testcases) == 0:
                logger.warning("Question validation failed - missing test cases", extra={
                    "question_type": qtype
                })
                raise serializers.ValidationError("Test cases are required for coding questions.")

            for i, tc in enumerate(testcases):
                if "input_data" not in tc or "expected_output" not in tc:
                    logger.warning("Question validation failed - invalid test case format", extra={
                        "question_type": qtype,
                        "testcase_index": i,
                        "missing_fields": [f for f in ["input_data", "expected_output"] if f not in tc]
                    })
                    raise serializers.ValidationError(f"Each test case must have 'input_data' and 'expected_output'. Error at index {i}.")

        return attrs

    def create(self, validated_data):
        dataset_id = validated_data.pop("dataset_id", None)
        max_rows = validated_data.pop("max_rows", 5000)
        testcases = validated_data.pop("testcases", [])

        # Create Question
        question = Question.objects.create(**validated_data)

        # Create SQLQuestion
        if validated_data.get("question_type") == "sql" and dataset_id:
            dataset = SQLDataset.objects.get(id=dataset_id)
            SQLQuestion.objects.create(
                question=question,
                dataset=dataset,
                max_rows=max_rows
            )

        # Create coding testcases
        if validated_data.get("question_type") == "coding" and testcases:
            for tc in testcases:
                TestCase.objects.create(
                    question=question,
                    input_data=tc.get("input_data", ""),
                    expected_output=tc.get("expected_output", ""),
                    points=tc.get("points", 1.0),
                    is_hidden=tc.get("is_hidden", True)
                )

        return question

    def update(self, instance, validated_data):
        dataset_id = validated_data.pop("dataset_id", None)
        max_rows = validated_data.pop("max_rows", 5000)
        testcases = validated_data.pop("testcases", [])
        # always update description
        instance.description = validated_data.get("description", "")

        instance = super().update(instance, validated_data)
        qtype = instance.question_type

         # update SQL dataset if needed
        if instance.question_type == "sql" and dataset_id:
            dataset = SQLDataset.objects.get(id=dataset_id)
            SQLQuestion.objects.update_or_create(
                question=instance,
                defaults={
                    "dataset": dataset,
                    "max_rows": max_rows
                }
            )

        # update coding testcases
        if instance.question_type == "coding":
            # delete old testcases
            TestCase.objects.filter(question=instance).delete()

            # create new ones
            for tc in testcases:
                TestCase.objects.create(
                    question=instance,
                    input_data=tc.get("input_data", ""),
                    expected_output=tc.get("expected_output", ""),
                    points=tc.get("points", 1.0),
                    is_hidden=tc.get("is_hidden", True)
                )

        return instance
    

class QuestionBulkDeleteSerializer(serializers.Serializer):
    question_ids = serializers.ListField(
        child=serializers.IntegerField(), allow_empty=False
    )


class QuestionImportSerializer(serializers.Serializer):
    file = serializers.FileField()
    # file_type = serializers.ChoiceField(choices=("csv", "xlsx", ""))



class TestCaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestCase
        fields = ["id", "input_data", "expected_output", "points", "is_hidden"]



class AssessmentSerializer(serializers.ModelSerializer):
    categories = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.none(), many=True
    )
    question_ids = serializers.PrimaryKeyRelatedField(
        queryset=Question.objects.none(), source="questions", many=True, required=False
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        request = self.context.get("request")
        user = getattr(request, "user", None)

        if user and user.is_authenticated:
            self.fields["categories"].child_relation.queryset = (
                Category.objects.all_for_super_admin()
            )
            self.fields["question_ids"].child_relation.queryset = (
                Question.objects.all_for_super_admin()
            )

    total_assigned = serializers.IntegerField(read_only=True)
    completed = serializers.IntegerField(read_only=True)
    in_progress = serializers.IntegerField(read_only=True)
    expired = serializers.IntegerField(read_only=True)
    
    status = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    created_by_role = serializers.SerializerMethodField()
    class Meta:
        model = Assessment
        fields = [
            "id",
            "title",
            "description",
            "created_by_name",
            "created_by_role",
            # "categories",
            # "question_ids",
            "total_assigned",
            "completed",
            "in_progress",
            "expired",  
            "is_active",
            "duration",
            "start_date",
            "end_date",
            "shuffle_questions",
            "shuffle_options",
            "instructions",
            "passing_percentage",
            "status",            
            "categories",
            "question_ids",  
                    
        ]

    def get_status(self, obj):
        now = timezone.now()

        if obj.start_date <= now <= obj.end_date:
            return "active"
        elif obj.start_date > now:
            return "upcoming"
        elif obj.end_date < now:
            return "completed"
        return None

    def get_created_by_name(self, obj):
        u = getattr(obj, "created_by", None)
        if not u:
            return None
        full = f"{getattr(u, 'first_name', '') or ''} {getattr(u, 'last_name', '') or ''}".strip()
        return full or getattr(u, "name", "") or getattr(u, "email", "") or getattr(u, "username", None)

    def get_created_by_role(self, obj):
        return getattr(getattr(obj, "created_by", None), "role", None)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        stats = self.context.get("stats", {})

        # Build ordered response manually
        ordered_data = {
            "id": data.get("id"),
            "title": data.get("title"),
            "description": data.get("description"),
            "created_by_name": data.get("created_by_name"),
            "created_by_role": data.get("created_by_role"),

            # stats at TOP (your requirement)
            "total_assigned": stats.get("total_assigned", 0),
            "completed": stats.get("completed", 0),
            "in_progress": stats.get("in_progress", 0),
            "expired": stats.get("expired", 0),

            # remaining fields
            "is_active": data.get("is_active"),
            "duration": data.get("duration"),
            "start_date": data.get("start_date"),
            "end_date": data.get("end_date"),
            "shuffle_questions": data.get("shuffle_questions"),
            "shuffle_options": data.get("shuffle_options"),
            "instructions": data.get("instructions"),
            "passing_percentage": data.get("passing_percentage"),
            "status": data.get("status"),

            "categories": data.get("categories"),
            "question_ids": data.get("question_ids"),
        }

        return ordered_data
    def create(self, validated_data):
        try:
            categories = validated_data.pop("categories", [])
            questions = validated_data.pop("questions", [])
            assessment = Assessment.objects.create(**validated_data)
            logger.info("Assessment created successfully", extra={
                "assessment_id": assessment.id,
                "title": assessment.title
            })
            
            assessment.categories.set(categories)
            if questions:
                assessment.questions.set(questions)
        except Exception as e:
            logger.exception("Error creating assessment", extra={
                "title": validated_data.get("title", "")
            })
            raise
        return assessment

    def update(self, instance, validated_data):
        try:
            categories = validated_data.pop("categories", None)
            questions = validated_data.pop("questions", None)
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()
            logger.info("Assessment fields updated", extra={
                "assessment_id": instance.id,
                "updated_field_count": len(validated_data)
            })
            
            if categories is not None:
                instance.categories.set(categories)
                logger.info("Assessment categories updated", extra={
                    "assessment_id": instance.id,
                    "category_count": len(categories)
                })
            
            if questions is not None:
                instance.questions.set(questions)
                logger.info("Assessment questions updated", extra={
                    "assessment_id": instance.id,
                    "question_count": len(questions)
                })
        except Exception as e:
            logger.exception("Error updating assessment", extra={
                "assessment_id": instance.id,
                "title": instance.title
            })
            raise
        return instance


class AssessmentAssignmentSerializer(serializers.Serializer):
    candidate_ids = serializers.ListField(
        child=serializers.IntegerField(), allow_empty=False
    )


class AssessmentUnassignSerializer(serializers.Serializer):
    candidate_assessment_ids = serializers.ListField(
        child=serializers.IntegerField(), allow_empty=False
    )


class AssessmentDuplicateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=200, required=False)


class CandidateAssessmentSerializer(serializers.ModelSerializer):
    candidate = CandidateSerializer(read_only=True)
    assessment = AssessmentSerializer(read_only=True)
    total_marks = serializers.SerializerMethodField()
    score = serializers.SerializerMethodField()
    percentage = serializers.SerializerMethodField()
    certificate_eligible = serializers.SerializerMethodField()

    class Meta:
        model = CandidateAssessment
        fields = [
            "id",
            "candidate",
            "assessment",
            "assigned_by",
            "assigned_date",
            "start_time",
            "end_time",
            "status",
            "score",
            "total_marks",
            "percentage",
            "certificate_eligible",
        ]
        read_only_fields = fields

    def get_total_marks(self, obj: CandidateAssessment) -> float:
        if getattr(obj, "total_marks", None):
            return float(obj.total_marks)
        cached = getattr(obj, "_computed_total_marks", None)
        if cached is None:
            cached = obj.assessment.questions.aggregate(total=Sum("marks")).get("total") or 0
            obj._computed_total_marks = cached
        return float(cached)

    def get_score(self, obj: CandidateAssessment) -> float:
        if getattr(obj, "score", None):
            return float(obj.score)
        return 0.0

    def get_percentage(self, obj: CandidateAssessment) -> float:
        if getattr(obj, "percentage", None):
            return float(obj.percentage)
        total_marks = self.get_total_marks(obj)
        if total_marks <= 0:
            return 0.0
        score = getattr(obj, "score", 0) or 0
        return round(float(score) / float(total_marks) * 100, 2)

    def get_certificate_eligible(self, obj: CandidateAssessment) -> bool:
        passing = getattr(obj.assessment, 'passing_percentage', 0) or 0
        if passing <= 0:
            return False
        pct = self.get_percentage(obj)
        return pct >= passing


class CandidateResponseSerializer(serializers.ModelSerializer):
    question_title = serializers.CharField(source="question.title", read_only=True)
    question_type = serializers.CharField(source="question.question_type", read_only=True)
    question_description = serializers.CharField(source="question.description", read_only=True)
    question_marks = serializers.CharField(source="question.marks", read_only=True)
    question_difficulty = serializers.CharField(source="question.difficulty", read_only=True)
    answer_text = serializers.SerializerMethodField()
    question_options = serializers.SerializerMethodField()
    correct_answer = serializers.SerializerMethodField()
    correct_answer_text = serializers.SerializerMethodField()

    class Meta:
        model = Response
        fields = [
            "question_id",
            "question_title",
            "question_description",
            "question_marks",
            "question_difficulty",
            "question_type",
            "answer",
            "answer_text",
            "question_options",
            "correct_answer",
            "correct_answer_text",
            "is_correct",
            "marks_obtained",
        ]
        read_only_fields = fields

    def get_answer_text(self, obj: Response) -> str:
        question_type = getattr(obj.question, "question_type", "")
        if question_type in {"mcq_single", "mcq_multiple", "fill_blank"}:
            return _humanize_mcq_answer(obj.question, obj.answer)
        if question_type == "true_false":
            return (obj.answer or "").capitalize()
        return obj.answer or ""

    def get_question_options(self, obj: Response) -> List[dict]:
        question = obj.question
        if getattr(question, "question_type", "") not in {"mcq_single", "mcq_multiple", "true_false", "fill_blank"}:
            return []

        options = []
        for label, attr in MCQ_OPTION_LABELS:
            option_text = getattr(question, attr, "") or ""
            if option_text:
                options.append({
                    "label": label,
                    "value": option_text,
                })
        return options

    def get_correct_answer(self, obj: Response) -> str:
        return getattr(obj.question, "correct_answer", "") or ""

    def get_correct_answer_text(self, obj: Response) -> str:
        question = obj.question
        question_type = getattr(question, "question_type", "")
        correct_answer = getattr(question, "correct_answer", "")
        if not correct_answer:
            return ""
        if question_type in {"mcq_single", "mcq_multiple", "fill_blank"}:
            return _humanize_mcq_answer(question, correct_answer)
        if question_type == "true_false":
            return correct_answer.capitalize()
        return correct_answer


class SaveAnswerSerializer(serializers.Serializer):
    assessment_id = serializers.IntegerField()
    question_id = serializers.IntegerField()
    answer = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    code_language = serializers.CharField(required=False, allow_blank=True)


class RunCodeSerializer(serializers.Serializer):
    question_id = serializers.IntegerField(required=True)
    source_code = serializers.CharField(required=False, allow_blank=True, default='')
    code = serializers.CharField(required=False, allow_blank=True, default='')
    language = serializers.CharField()
    stdin = serializers.CharField(required=False, allow_blank=True)
    use_custom_input = serializers.BooleanField(required=False, default=False)
    assessment_id = serializers.IntegerField(required=False, allow_null=True)



class ProctoringIncidentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProctoringIncident
        fields = [
            "id",
            "candidate",
            "assessment",
            "incident_type",
            "timestamp",
            "details",
            "screenshot_s3_url",
            "severity",
        ]
        read_only_fields = ["id", "timestamp"]


class ProctoringIncidentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProctoringIncident
        fields = [
            "candidate",
            "assessment",
            "incident_type",
            "details",
            "screenshot_s3_url",
            "severity",
        ]


class BulkUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    model_type = serializers.ChoiceField(choices=(("candidate", "candidate"), ("question", "question")))


class CandidateWebhookSerializer(serializers.Serializer):
    name = serializers.CharField()
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(
        required=False,
        allow_blank=True,
        validators=[
            RegexValidator(regex=r"^\d{10}$", message="Enter valid 10 digit phone"),
        ],
    )
    profile = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if not attrs.get("email") and not attrs.get("phone"):
            raise serializers.ValidationError("Provide either email or phone.")
        return attrs


class ForgotPasswordSerializer(serializers.Serializer):
    contact = serializers.CharField()


class ResetPasswordOTPSerializer(serializers.Serializer):
    otp_code = serializers.CharField(
        max_length=6,
        min_length=6,
        validators=[
            RegexValidator(regex=r"^\d{6}$", message="Enter a valid six-digit OTP"),
        ],
    )


class ResetPasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(min_length=8)
    confirm_password = serializers.CharField(min_length=8)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError("Passwords do not match.")
        return attrs


class CandidateProfileSerializer(serializers.ModelSerializer):
    resume = serializers.FileField(required=False)
    avatar = serializers.FileField(required=False)
    projects = serializers.JSONField(default=list)

    class Meta:
        model = User
        fields = [
            "first_name",
            "last_name",
            "email",
            "phone",
            "profile",
            "resume",
            "avatar",
            "professional_summary",
            "tech_stack",
            "services_worked_on",
            "payment_methods_used",
            "projects",
        ]

    def validate_email(self, value):
        user = self.context["request"].user
        if User.objects.exclude(id=user.id).filter(email__iexact=value).exists():
            logger.warning("Profile update - email validation failed", extra={
                "user_id": user.id,
                "email": value,
                "reason": "Email already in use"
            })
            raise serializers.ValidationError("Email already in use.")
        return value.lower()

    def validate_phone(self, value):
        user = self.context["request"].user
        if User.objects.exclude(id=user.id).filter(phone=value).exists():
            logger.warning("Profile update - phone validation failed", extra={
                "user_id": user.id,
                "phone": value,
                "reason": "Phone already in use"
            })
            raise serializers.ValidationError("Phone already in use.")
        return value

    def save(self, **kwargs):
        # Extract avatar file before saving
        avatar_file = self.validated_data.pop('avatar', None)
        # Save the instance first
        instance = super().save(**kwargs)
        
        # Handle avatar upload to S3 if provided
        if avatar_file:
            try:
                logger.info("Uploading avatar to S3 for profile update", extra={
                    "user_id": instance.id,
                    "email": instance.email
                })
                from .storage_utils import s3_handler
                avatar_url = s3_handler.upload_avatar(avatar_file, instance.email)
                if avatar_url:
                    instance.avatar = avatar_url
                    instance.save(update_fields=['avatar'])
                    logger.info(f"Avatar uploaded successfully for user {instance.email}")
            except Exception as e:
                logger.exception("Error uploading avatar to S3 for profile update", extra={
                    "user_id": instance.id,
                    "email": instance.email
                })
        
        return instance


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField()
    new_password = serializers.CharField(min_length=8)


class SQLDatasetSerializer(serializers.ModelSerializer):
    class Meta:
        model = SQLDataset
        fields = ["id", "name", "engine", "schema_ddl", "seed_sql"]


class SQLRunSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()
    query = serializers.CharField()
    assessment_id = serializers.IntegerField(required=False, allow_null=True)


class SQLGradeSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()
    query = serializers.CharField()
    assessment_id = serializers.IntegerField()


class SQLQuestionSerializer(serializers.ModelSerializer):
    dataset_name = serializers.CharField(source="dataset.name", read_only=True)
    dataset_engine = serializers.CharField(source="dataset.engine", read_only=True)
    sql_testcases = SQLTestCaseSerializer(many=True, read_only=True)

    class Meta:
        model = SQLQuestion
        fields = [
            "id", "dataset", "dataset_name", "dataset_engine", "reference_solution",
            "strict_column_order", "float_tolerance", "max_rows", "sql_testcases"
        ]
