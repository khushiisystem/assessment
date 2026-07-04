from rest_framework import serializers
from .models import Question, InterviewTemplate, Candidate, MockSession, CandidateInterviewer


class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = ['id', 'text', 'ideal_answer', 'stack', 'difficulty', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class QuestionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = ['text', 'ideal_answer', 'stack', 'difficulty']

    def validate_stack(self, value):
        return value.strip() if value else value


class InterviewTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = InterviewTemplate
        fields = ['id', 'name', 'questions', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class InterviewTemplateCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = InterviewTemplate
        fields = ['name', 'questions']


class CandidateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Candidate
        fields = ['id', 'name', 'email', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

class CandidateInterviewerSerializer(serializers.ModelSerializer):
    class Meta:
        model = CandidateInterviewer
        fields = ['id', 'name', 'email', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']



class CandidateCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Candidate
        fields = ['name', 'email']

class CandidateInterviewerCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CandidateInterviewer
        fields = ['name', 'email']


class MockSessionSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    display_email = serializers.SerializerMethodField()

    def get_display_name(self, obj):
        if obj.registered_user_id:
            u = obj.registered_user
            name = getattr(u, 'name', '') or u.get_full_name() or u.username
            return name
        return obj.candidate_name

    def get_display_email(self, obj):
        if obj.registered_user_id:
            return obj.registered_user.email
        return obj.candidate_email or ''

    class Meta:
        model = MockSession
        fields = [
            'id', 'candidate_name', 'candidate_email', 'candidate_id',
            'candidate_interviewer_name', 'candidate_interviewer_email', 'candidate_interviewer_id',
            'registered_user_id', 'display_name', 'display_email',
            'stack', 'status', 'version_label', 'questions', 'responses',
            'overall_feedback', 'created_at', 'updated_at', 'scheduled_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class MockSessionCreateSerializer(serializers.Serializer):
    candidate_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    candidate_email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    candidate_interviewer_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    candidate_interviewer_email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    user_id = serializers.IntegerField(required=False, write_only=True, allow_null=True)
    stack = serializers.CharField(max_length=100)
    version_label = serializers.CharField(max_length=100)
    questions = serializers.ListField(child=serializers.IntegerField())
    scheduled_at = serializers.DateTimeField(required=False, allow_null=True)


class MockSessionUpdateSerializer(serializers.Serializer):
    status = serializers.CharField(max_length=20)
    overall_feedback = serializers.CharField(required=False, allow_blank=True)
    responses = serializers.DictField()


class CandidateAnalyticsSerializer(serializers.Serializer):
    candidate = CandidateSerializer()
    candidate_interviewer = CandidateInterviewerSerializer()
    history = serializers.ListField()
    skills = serializers.DictField()
