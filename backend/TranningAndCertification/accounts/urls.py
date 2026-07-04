from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import UserViewSet, LoginView, register, google_login, create_token, google_oauth_login, google_oauth_callback , send_otp , verify_otp , reset_password, UserProfileView, AcceptInviteView, AcceptInviteInfoView
router = DefaultRouter()
router.register('users', UserViewSet, basename='user')

urlpatterns = [
    path('', include(router.urls)),
    
    # User Authentication Endpoints
    # path('auth/register', register, name='register'),
    path('auth/login', LoginView.as_view(), name='e-learning-login'),
    path('auth/refresh', TokenRefreshView.as_view(), name='token_refresh'),

    # Org-admin invite acceptance (public)
    path('auth/accept-invite/info', AcceptInviteInfoView.as_view(), name='accept-invite-info'),
    path('auth/accept-invite', AcceptInviteView.as_view(), name='accept-invite'),
    
    # Google OAuth2 Endpoints
    path('auth/google', google_login, name='google_login'),
    path('auth/token', create_token, name='create_token'),
    path('auth/google/login', google_oauth_login, name='google_oauth_login'),
    path('auth/google/callback', google_oauth_callback, name='google_oauth_callback'),

    # # Forget password, change password, etc.
    # path('auth/forgot-password/', send_otp, name='forgot-password'),
    # path('auth/verify-otp/', verify_otp, name='verify-otp'),
    # path('auth/reset-password/', reset_password, name='reset-password'),
    path('profile/', UserProfileView.as_view(), name='user-profile'),

]


