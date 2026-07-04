from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from core.models import User
from learning.serializers import UserTechnologyProgressSerializer
from learning.serializers import AssignmentSerializer

class UserSerializer(serializers.ModelSerializer):
    overallProgress = serializers.SerializerMethodField()
    technologies = UserTechnologyProgressSerializer(source='technologies_progress', many=True, read_only=True)

    class Meta:
        model = User
        fields = ['id', 'name', 'email', 'avatar', 'profile', 'role', 'organization', 'is_individual', 'overallProgress','technologies']
        read_only_fields = ['email', 'role', 'is_individual', 'overallProgress', 'technologies']

    def get_overallProgress(self, obj):
        techs = obj.technologies_progress.all()
        if not techs.exists():
            return 0
        avg = sum([t.progress for t in techs]) / techs.count()
        return round(avg)


    


class AdminCreateUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'name', 'email', 'role', 'profile_title']


class LoginSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['name'] = user.full_name
        token['organization_id'] = user.organization_id
        return token

    def validate(self, attrs):
        data = super().validate(attrs)

        # Check if user should be disabled (temporary user expired)
        # self.user.disable_if_expired()

        # Check if user is active
        # if not self.user.is_active:
        #     raise serializers.ValidationError({
        #         'detail': 'Your account has been disabled. Please contact support.'
        #     })

        data['user'] = {
            'id': self.user.id,
            'name': self.user.full_name,
            'email': self.user.email,
            'role': self.user.role,
            'organization_id': self.user.organization_id,
            'is_individual': getattr(self.user, 'is_individual', False),
        }

        data['name'] = self.user.full_name  # Root level par bhi

        return data