from rest_framework import serializers

from .models import Organization


class OrganizationSerializer(serializers.ModelSerializer):
    # Live usage: how many candidates this org currently has (read-only).
    candidates_count = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
            "legal_name",
            "short_name",
            "organization_type",
            "description",
            "logo_url",
            "founded_date",
            "status",
            "primary_email",
            "secondary_email",
            "phone",
            "alternate_phone",
            "toll_free",
            "website",
            "linkedin",
            "twitter",
            "facebook",
            "instagram",
            "youtube",
            "slug",
            "is_active",
            "candidate_limit",
            "candidates_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["slug", "is_active", "candidates_count", "created_at", "updated_at"]

    def get_candidates_count(self, obj):
        try:
            from core.models import User
            return User.objects.filter(organization=obj, role="candidate").count()
        except Exception:
            return 0
