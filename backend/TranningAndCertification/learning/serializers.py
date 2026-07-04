from rest_framework import serializers
from .models import  (Technology, 
                      Question, 
                      Assignment, Completion, 
                      UserTechnologyProgress )
from core.models import User
from django.utils import timezone
from django.db.models import Count, Prefetch

class TechnologySerializer(serializers.ModelSerializer):
    total_questions = serializers.SerializerMethodField()
    total_assigned_users = serializers.SerializerMethodField()
    icon = serializers.ImageField(required=False, allow_null=True, write_only=True)
    icon_url = serializers.SerializerMethodField()
    clear_icon = serializers.BooleanField(required=False, default=False, write_only=True)


    class Meta:
        model = Technology
        fields = [
            'id', 'name', 'category', 'description',
            'icon', 'icon_key', 'icon_url', 'clear_icon',
            'total_questions', 'total_assigned_users',
            'created_at', 'updated_at'
        ]

    def get_total_questions(self, obj):
        from learning.models import Question as LearningQuestion
        return LearningQuestion.objects.all_for_super_admin().filter(technology=obj).count()

    def get_total_assigned_users(self, obj):
        # DISTINCT candidates assigned to this technology — NOT raw Assignment
        # rows (a candidate has one row per assigned question, which inflates
        # the count). Prefer the org-scoped queryset annotation; fall back to a
        # direct distinct query for single-object (retrieve/create) responses.
        annotated = getattr(obj, "enrolled_users_count", None)
        if annotated is not None:
            return annotated
        return obj.assignment_set.values("user").distinct().count()

    # def get_candidates(self, obj):
    #     """
    #     All candidates assigned to this technology
    #     with their progress
    #     """
    #     request = self.context.get("request")

    #     # Safety: only admin should see all candidates
    #     if not request.user.is_staff and request.user.role != "super_admin":
    #         return []

    #     # Use prefetched data from ViewSet instead of querying again
    #     progress_list = obj.usertechnologyprogress_set.all()
        
    #     # Collect all user IDs to batch query assignments
    #     user_ids = [p.user_id for p in progress_list]
        
    #     # Batch query assignments instead of querying per user
    #     assignments_map = {}
    #     if user_ids:
    #         assignments = Assignment.objects.filter(
    #             user_id__in=user_ids,
    #             technology=obj
    #         ).values_list('user_id', 'id')
    #         assignments_map = dict(assignments)
        
    #     data = []
    #     for p in progress_list:
    #         row = CandidateTechnologyProgressSerializer(p).data
    #         row["assignment_id"] = assignments_map.get(p.user_id)
    #         data.append(row)
    #     return data    
    
    def get_icon_url(self, obj):
        if obj.icon:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.icon.url)
            return obj.icon.url
        return None

    def create(self, validated_data):
        validated_data.pop('clear_icon', None)  # not a model field
        if validated_data.get('icon'):
            validated_data['icon_key'] = None  # auto-clear key when image uploaded
        return super().create(validated_data)

    def update(self, instance, validated_data):
        clear_icon = validated_data.pop('clear_icon', False)
        new_icon = validated_data.get('icon')

        if clear_icon:
            # Admin explicitly removed the icon
            if instance.icon:
                instance.icon.delete(save=False)
            validated_data['icon'] = None
        elif new_icon:
            # New image uploaded — auto-clear the iconify key
            validated_data['icon_key'] = None
        elif validated_data.get('icon_key'):
            # Iconify key set — clear any uploaded image
            if instance.icon:
                instance.icon.delete(save=False)
            validated_data['icon'] = None

        return super().update(instance, validated_data)

    def validate(self, attrs):
        """
        Prevent duplicate Technology creation
        based on name and category (case-insensitive).
        """
        name = attrs.get('name')

        # Check duplicates on create
        qs = Technology.objects.filter(name__iexact=name)

        # Exclude the current instance on update
        if self.instance:
            qs = qs.exclude(id=self.instance.id)

        if qs.exists():
            raise serializers.ValidationError({
                "name": "A technology with this name already exists."
            })

        return attrs




class QuestionSerializer(serializers.ModelSerializer):
    technology = TechnologySerializer(read_only=True)

    class Meta:
        model = Question
        fields = [
            'id',
            'technology',
            'question',
            'answer',
            'difficulty',
            'is_active',
            'reference_link',
            'task_description',
            'task_file',   
            'module_level',
        ]

    


class AssignmentSerializer(serializers.ModelSerializer):
    userId = serializers.IntegerField(source='user.id', read_only=False)
    technologyId = serializers.CharField(source='technology.id', read_only=False)
    assignedBy = serializers.IntegerField(source='assigned_by.id', read_only=False)

    class Meta:
        model = Assignment
        fields = [
            'id', 'userId', 'technologyId',
            'assignedBy', 'assigned_at', 'due_at', 'notes'
        ]


class CompletionSerializer(serializers.ModelSerializer):
    userId = serializers.PrimaryKeyRelatedField(source='user', queryset=User.objects.all())
    questionId = serializers.PrimaryKeyRelatedField(source='question', queryset=Question.objects.all())

    class Meta:
        model = Completion
        fields = ['id', 'userId', 'questionId', 'completed_at']
        read_only_fields = ['completed_at']


class UserTechnologyProgressSerializer(serializers.ModelSerializer):
    technologyId = serializers.PrimaryKeyRelatedField(
        source='technology', 
        read_only=True
    )
    name = serializers.CharField(source='technology.name', read_only=True)
    user_notes = serializers.SerializerMethodField()  # <-- override

    class Meta:
        model = UserTechnologyProgress
        fields = ["technologyId", "name", "progress", "completed", "total", "user_notes"]

    def get_user_notes(self, obj):
        """
        Ensure we always return a single clean URL string.
        """
        notes = obj.user_notes

        if not notes:
            return None

        # If stored as stringified list => convert to real Python list
        if isinstance(notes, str) and notes.startswith("["):
            import ast
            try:
                notes = ast.literal_eval(notes)  # convert string → list
            except:
                return None

        # If list of dicts → return first url
        if isinstance(notes, list):
            if len(notes) > 0 and isinstance(notes[0], dict):
                return notes[0].get("url")

        # If user stored directly as string URL
        if isinstance(notes, str) and notes.startswith("http"):
            return notes

        return None


class QuestionImportSerializer(serializers.Serializer):
    file = serializers.FileField()

    def validate_file(self, file):
        valid_ext = ['csv', 'xls', 'xlsx']

        ext = file.name.split('.')[-1].lower()
        if ext not in valid_ext:
            raise serializers.ValidationError("Only CSV or Excel files are allowed.")

        return file


# class CandidateTechnologyProgressSerializer(serializers.ModelSerializer):
#     userId = serializers.UUIDField(source="user.id", read_only=True)
#     name = serializers.SerializerMethodField()
#     email = serializers.EmailField(source="user.email", read_only=True)
#     assigned_at = serializers.SerializerMethodField()   # ✅
#     due_at = serializers.SerializerMethodField()        # ✅
#     last_active_at = serializers.SerializerMethodField()

#     class Meta:
#         model = UserTechnologyProgress
#         fields = [
#             "userId",
#             "name",
#             "email",
#             "progress",
#             "completed",
#             "total",
#             "assigned_at",
#             "due_at",
#             "last_active_at",
#             "user_notes",
#         ]

#     def get_name(self, obj):
#         full_name = obj.user.get_full_name()
#         return full_name or None

#     def _get_assignment(self, obj):
#         """
#         Helper: get assignment for this user + technology
#         """
#         return (
#             Assignment.objects
#             .filter(
#                 user=obj.user,
#                 technology=obj.technology
#             )
#             .order_by("assigned_at")
#             .first()
#         )

#     # def get_assigned_at(self, obj):
#     #     assignment = self._get_assignment(obj)
#     #     if not assignment:
#     #         return None
#     #     return timezone.localtime(assignment.assigned_at)

#     # def get_due_at(self, obj):
#     #     assignment = self._get_assignment(obj)
#     #     if not assignment or not assignment.due_at:
#     #         return None
#     #     return timezone.localtime(assignment.due_at)

#     def get_last_active_at(self, obj):
#         last_completion = (
#             Completion.objects
#             .filter(
#                 user=obj.user,
#                 question__technology=obj.technology
#             )
#             .order_by("-completed_at")
#             .first()
#         )

#         if not last_completion:
#             return None

#         return timezone.localtime(last_completion.completed_at)


class CandidateTechnologyProgressSerializer(serializers.ModelSerializer):
    userId = serializers.IntegerField(source="user.id", read_only=True)  # ✅ FIXED
    name = serializers.SerializerMethodField()
    email = serializers.EmailField(source="user.email", read_only=True)

    # ✅ Now normal fields (NOT SerializerMethodField)
    assigned_at = serializers.DateTimeField(read_only=True)
    due_at = serializers.DateTimeField(read_only=True)

    last_active_at = serializers.SerializerMethodField()

    class Meta:
        model = UserTechnologyProgress
        fields = [
            "userId",
            "name",
            "email",
            "progress",
            "completed",
            "total",
            "assigned_at",
            "due_at",
            "last_active_at",
            "user_notes",
        ]

    def get_name(self, obj):
        return obj.user.get_full_name() or None

    def get_last_active_at(self, obj):
        last_completion = (
            Completion.objects
            .filter(
                user=obj.user,
                question__technology=obj.technology
            )
            .order_by("-completed_at")
            .first()
        )

        if not last_completion:
            return None

        return timezone.localtime(last_completion.completed_at)