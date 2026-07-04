from rest_framework import serializers

from AI_assessment.models import (
    AIAssessment,
    AIInterviewResponse,
    CandidateAIAssessment,
    Profile,
    Question,
    QuestionProfile,
)


def _display_name(user):
    """Friendly creator name: full name, then name, email, finally username."""
    if not user:
        return None
    full = f"{getattr(user, 'first_name', '') or ''} {getattr(user, 'last_name', '') or ''}".strip()
    return full or getattr(user, "name", "") or getattr(user, "email", "") or getattr(user, "username", None)


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = "__all__"


class QuestionSerializer(serializers.ModelSerializer):
    created_by_username = serializers.SerializerMethodField()
    updated_by_username = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = "__all__"

    def get_created_by_username(self, obj):
        return getattr(obj.created_by, "username", None)

    def get_updated_by_username(self, obj):
        return getattr(obj.updated_by, "username", None)


class QuestionProfileSerializer(serializers.ModelSerializer):
    question = QuestionSerializer(read_only=True)
    profile = ProfileSerializer(read_only=True)

    class Meta:
        model = QuestionProfile
        fields = "__all__"


class AIAssessmentSerializer(serializers.ModelSerializer):
    created_by_username = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    created_by_role = serializers.SerializerMethodField()
    assigned_candidates_count = serializers.SerializerMethodField()
    completed_candidates_count = serializers.SerializerMethodField()

    class Meta:
        model = AIAssessment
        fields = "__all__"
        read_only_fields = ("created_by", "created_at", "updated_at")
        extra_kwargs = {
            "gemini_api_key": {"write_only": True, "required": False, "allow_blank": True},
        }

    def get_created_by_username(self, obj):
        return getattr(obj.created_by, "username", None)

    def get_created_by_name(self, obj):
        return _display_name(obj.created_by)

    def get_created_by_role(self, obj):
        return getattr(obj.created_by, "role", None)

    def get_assigned_candidates_count(self, obj):
        if hasattr(obj, 'assigned_candidates_count'):
            return obj.assigned_candidates_count
        return obj.candidateaiassessment_set.count()

    def get_completed_candidates_count(self, obj):
        if hasattr(obj, 'completed_candidates_count'):
            return obj.completed_candidates_count
        return obj.candidateaiassessment_set.filter(status='completed').count()


class AIAssessmentBulkDeleteSerializer(serializers.Serializer):
    ai_assessment_ids = serializers.ListField(
        child=serializers.IntegerField(), allow_empty=False
    )


class CandidateAIAssessmentSerializer(serializers.ModelSerializer):
    candidate_username = serializers.SerializerMethodField()
    assigned_by_username = serializers.SerializerMethodField()
    certificate_eligible = serializers.SerializerMethodField()
    ai_assessment = AIAssessmentSerializer(read_only=True)

    class Meta:
        model = CandidateAIAssessment
        fields = "__all__"
        read_only_fields = (
            "assigned_by",
            "assigned_date",
            "start_time",
            "end_time",
            "status",
            "generated_questions",
            "ai_feedback",
            "question_wise_verification",
            "technical_score",
            "communication_score",
            "problem_solving_score",
            "overall_score",
            "technical_feedback",
            "communication_feedback",
            "problem_solving_feedback",
            "strengths_feedback",
            "improvement_feedback",
            "overall_feedback",
            "introduction_video_url",
            "introduction_video",
            "assessment_video_url",
            "interview_video",
            "interview_video_url",
            "screenshots",
            "periodic_screenshots",
            "gesture_analysis",
            "communication_metrics",
            "cheating_alerts",
            # "voice_flow_analysis",
            # "voice_flow_risk_score",
            # "voice_flow_risk_level",
        )

    def get_candidate_username(self, obj):
        return getattr(obj.candidate, "username", None)

    def get_assigned_by_username(self, obj):
        return getattr(obj.assigned_by, "username", None)

    def get_certificate_eligible(self, obj):
        passing = getattr(obj.ai_assessment, 'passing_percentage', 0) or 0
        if passing <= 0:
            return False
        candidate_pct = (obj.overall_score / 10) * 100 if obj.overall_score else 0
        return candidate_pct >= passing


class AIInterviewResponseSerializer(serializers.ModelSerializer):
    # voice_analysis = serializers.SerializerMethodField()

    class Meta:
        model = AIInterviewResponse
        fields = "__all__"
        read_only_fields = ("responded_at",)

#     def get_voice_analysis(self, obj):
#         analysis = getattr(obj, "voice_analysis", None)
#         if not analysis:
#             return None
#         return AIVoiceAnalysisSerializer(analysis).data


# class AIVoiceAnalysisSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = AIVoiceAnalysis
#         fields = (
#             "id",
#             "question_number",
#             "audio_duration_seconds",
#             "transcript_word_count",
#             "speech_rate_wpm",
#             "pause_count",
#             "long_pause_count",
#             "longest_pause_seconds",
#             "pause_timeline",
#             "speech_rate_timeline",
#             "filler_word_count",
#             "sentence_complexity_delta",
#             "answer_structure_score",
#             "mid_answer_shift_score",
#             "llm_consistency_score",
#             "overall_risk_score",
#             "risk_level",
#             "signals",
#             "llm_review",
#             "created_at",
#             "updated_at",
#         )


class CandidateAIAssessmentDetailSerializer(serializers.ModelSerializer):
    ai_assessment = AIAssessmentSerializer(read_only=True)
    responses = serializers.SerializerMethodField()
    certificate_eligible = serializers.SerializerMethodField()

    class Meta:
        model = CandidateAIAssessment
        fields = (
            "id",
            "candidate",
            "ai_assessment",
            "assigned_by",
            "assigned_date",
            "resume_text",
            "start_time",
            "end_time",
            "status",
            "generated_questions",
            "ai_feedback",
            "question_wise_verification",
            "technical_score",
            "communication_score",
            "problem_solving_score",
            "overall_score",
            "technical_feedback",
            "communication_feedback",
            "problem_solving_feedback",
            "strengths_feedback",
            "improvement_feedback",
            "overall_feedback",
            "introduction_video_url",
            "introduction_video",
            "assessment_video_url",
            "interview_video",
            "interview_video_url",
            "screenshots",
            "periodic_screenshots",
            "gesture_analysis",
            "communication_metrics",
            "cheating_alerts",
            "multiple_faces_count",
            "gaze_violation_count",
            "no_face_detection_count",
            "total_proctor_warnings",
            "responses",
            "certificate_eligible",
        )

    def get_certificate_eligible(self, obj):
        passing = getattr(obj.ai_assessment, "passing_percentage", 0) or 0
        if passing <= 0:
            return False
        candidate_pct = (obj.overall_score / 10) * 100 if obj.overall_score else 0
        return candidate_pct >= passing

    def get_responses(self, obj):
        responses = AIInterviewResponse.objects.filter(candidate_assessment=obj).order_by(
            "question_number"
        )
        return AIInterviewResponseSerializer(responses, many=True).data
