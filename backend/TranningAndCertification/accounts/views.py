import json
import logging
import random
import string
from datetime import timedelta
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.shortcuts import redirect
from django.template.loader import render_to_string
from django.utils import timezone
from google.auth.transport import requests as g_requests
from google.oauth2 import id_token
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import OTPVerification
from .serializers import AdminCreateUserSerializer, LoginSerializer, UserSerializer
logger = logging.getLogger(__name__)

User = get_user_model()


class IsOrgAdminOrSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (
                user.is_superuser
                or user.is_staff
                or user.role in {"super_admin", "org_admin"}
            )
        )

class UserProfileView(generics.RetrieveUpdateAPIView):
    logger.info("Initializing UserProfileView")
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        """Return only the logged-in user"""
        return self.request.user





# ViewSet for User model manage users (only admin access)
class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('id')
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated, IsOrgAdminOrSuperAdmin]
    filterset_fields = []
    search_fields = ['name', 'email']

    http_method_names = ['get', 'put', 'patch', 'delete']
    logger.info("UserViewSet initialized")

    def get_queryset(self):
        queryset = User.objects.filter(role='candidate').order_by('id')
        user = self.request.user
        if user.role == "super_admin" or user.is_superuser:
            return queryset
        return queryset.filter(organization_id=user.organization_id)


# Register a new user 
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register(request):
    """
    Register a new user account.

    Expected JSON:
    {
        "email": "user@example.com",
        "password": "StrongPass@123",
        "name": "Vijay Gupta",
        "role": "candidate"   # optional, defaults to 'candidate'
    }
    """    
    email = request.data.get('email')
    password = request.data.get('password')
    name = request.data.get('name')
    role = request.data.get('role', 'candidate')
    logger.info("Received registration request for email: %s", email)
    organization_id = request.data.get('organization_id')
    
    if not email or not password or not name:
        return Response({'detail': 'Email, password, name are required'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Validate email format
    try:
        logger.info("Validating email format for: %s", email)
        validate_email(email)
    except ValidationError:
        logger.warning("Invalid email format for: %s", email)
        return Response({"detail": "Invalid email format."}, status=status.HTTP_400_BAD_REQUEST)


    if User.objects.filter(email=email).exists():
        logger.warning("Email already registered: %s", email)
        return Response({'detail': 'Email already registered'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Create user
    user = User.objects.create_user(
        username=email,
        email=email,
        name=name,
        role=role,
        organization_id=organization_id,
    )
    user.set_password(password)
    user.save()

    # Send welcome email
    try:
        logger.info("Sending welcome email to: %s", email)
        subject = "Welcome to SkilTechy"
        message = f"""
                    Hello {name or 'there'},

                    Welcome to SkilTechy! Your account has been created successfully.

                    You can log in using the following credentials:
                    --------------------------------------------
                    Email: {email}
                    Password: {password}
                    --------------------------------------------

                    For security reasons, please change your password after logging in.

                    Best regards,
                    The SkilTechy Team
                    """
        html_message = render_to_string('emails/account_welcome.html', {
            'name': name or 'there',
            'email': email,
            'password': password,
            'login_url': settings.FRONTEND_URL.rstrip('/') + '/login',
        })
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
            html_message=html_message,
        )
        logger.info("Welcome email sent successfully", extra={
            "user_id": user.id,
            "email": user.email
        })
    except Exception:  # noqa: BLE001
        logger.exception("Welcome email failed", extra={"email": email, "user_id": user.id})


    logger.info("User registration completed successfully", extra={
        "user_id": user.id,
        "email": user.email,
        "role": user.role
    })
    
    # Do NOT return tokens on register; only basic user info
    return Response({
        'user': {
            'id': user.id,
            'name': user.name or '',
            'email': user.email,
            'role': user.role,
            'organization_id': user.organization_id,
        }
    }, status=status.HTTP_201_CREATED)


# Login View using JWT for user authentication
class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer



@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def google_login(request):
    token = request.data.get('id_token')
    client_id = request.data.get('client_id') or None
    if not token:
        logger.warning("Google login validation failed - missing id_token")
        return Response({'detail': 'id_token required'}, status=400)
    try:
        logger.info("Verifying Google login token")
        # Audience MUST be our own configured client id — never the client-supplied
        # one, otherwise tokens minted for other OAuth apps would be accepted.
        info = id_token.verify_oauth2_token(token, g_requests.Request(), audience=settings.GOOGLE_OAUTH_CLIENT_ID)
        email = info.get('email')
        name = info.get('name') or ''
        if not email:
            logger.warning("Google login validation failed - no email in token")
            return Response({'detail': 'Invalid token: no email'}, status=400)

        logger.info("Google login token verification successful", extra={"email": email})
        user, created = User.objects.get_or_create(
            email=email,
            defaults={'username': email, 'name': name, 'role': 'candidate', 'organization_id': request.data.get('organization_id')}
        )
        
        if created:
            logger.info("New user created via Google login", extra={
                "user_id": user.id,
                "email": user.email
            })
        else:
            logger.info("Existing user logged in via Google", extra={
                "user_id": user.id,
                "email": user.email
            })

        # Auto-disable temporary users after 24 hours (no cron) on Google login
        #user.disable_if_expired()

        # if not user.is_active:
        #     logger.warning("Google login failed - user account disabled", extra={
        #         "user_id": user.id,
        #         "email": user.email
        #     })
            # return Response(
            #     {'detail': 'Your account has been disabled. Please contact support.'},
            #     status=403,
            # )

        logger.info("Google login successful", extra={
            "user_id": user.id,
            "email": user.email
        })
        return Response({'user': {'id': user.id, 'name': user.name or '', 'email': user.email, 'role': user.role}})
    except Exception:
        logger.exception("Google login token verification failed")
        return Response({'detail': 'Invalid Google token'}, status=400)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def create_token(request):
    """Issue/get a unique DRF Token for a user. Accepts either email/password or Google id_token."""
    from rest_framework.authtoken.models import Token
    email = request.data.get('email')
    password = request.data.get('password')
    gid_token = request.data.get('id_token')
    client_id = request.data.get('client_id') or None

    user = None
    if gid_token:
        logger.info("Token creation via Google OAuth")
        try:
            info = id_token.verify_oauth2_token(gid_token, g_requests.Request(), audience=settings.GOOGLE_OAUTH_CLIENT_ID)
            email = info.get('email')
            name = info.get('name') or ''
            if not email:
                return Response({'detail': 'Invalid token: no email'}, status=400)
            user, created = User.objects.get_or_create(email=email, defaults={'username': email, 'name': name, 'role': 'candidate'})
            logger.info("Google OAuth verification successful", extra={
                "user_id": user.id,
                "email": email,
                "user_created": created
            })
        except Exception:
            return Response({'detail': 'Invalid Google token'}, status=400)
    else:
        if not email or not password:
            logger.warning("Token creation validation failed - missing email or password")
            return Response({'detail': 'Email and password are required'}, status=400)
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({'detail': 'Invalid credentials'}, status=400)
        if not user.check_password(password):
            return Response({'detail': 'Invalid credentials'}, status=400)

    # Check if user should be disabled (temporary user expired)
    #user.disable_if_expired()

    # Check if user is activex 
    # if not user.is_active:
    #     logger.warning("Token creation failed - user account disabled", extra={"user_id": user.id, "email": user.email})
    #     return Response({
    #         'detail': 'Your account has been disabled. Please contact support.'
    #     }, status=403)

    token, _ = Token.objects.get_or_create(user=user)
    logger.info("Token created successfully", extra={"user_id": user.id, "email": user.email})
    return Response({'token': token.key, 'user': {'id': user.id, 'name': user.name or '', 'email': user.email, 'role': user.role, 'organization_id': user.organization_id}})


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def google_oauth_login(request):
    """Redirect URL to start Google OAuth consent screen."""
    params = {
        'client_id': settings.GOOGLE_OAUTH_CLIENT_ID,
        'redirect_uri': settings.GOOGLE_OAUTH_REDIRECT_URI,
        'response_type': 'code',
        'scope': 'openid email profile',
        'access_type': 'offline',
        'prompt': 'select_account',
    }
    url = 'https://accounts.google.com/o/oauth2/v2/auth?' + urlencode(params)
    return Response({'auth_url': url})




def generate_password(length=12):
    logger.info("Generating random password of length %s", length)
    chars = string.ascii_letters + string.digits + "@#$!"
    return ''.join(random.choice(chars) for _ in range(length))

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def google_oauth_callback(request):
    """Handle Google's redirect, exchange code for tokens, return JWT token and user."""
    code = request.query_params.get('code')
    if not code:
        return Response({'detail': 'Missing code'}, status=400)

    data = urlencode({
        'code': code,
        'client_id': settings.GOOGLE_OAUTH_CLIENT_ID,
        'client_secret': settings.GOOGLE_OAUTH_CLIENT_SECRET,
        'redirect_uri': settings.GOOGLE_OAUTH_REDIRECT_URI,
        'grant_type': 'authorization_code',
    }).encode('utf-8')

    req = Request('https://oauth2.googleapis.com/token', data=data, headers={'Content-Type': 'application/x-www-form-urlencoded'})
    try:
        logger.info("Exchanging Google OAuth code for tokens")
        with urlopen(req) as resp:
            token_payload = json.loads(resp.read().decode('utf-8'))
    except Exception:
        logger.exception("Failed to exchange Google OAuth code for tokens")
        return Response({'detail': 'Token exchange failed'}, status=400)

    id_tok = token_payload.get('id_token')
    if not id_tok:
        return Response({'detail': 'No id_token in response'}, status=400)

    try:
        info = id_token.verify_oauth2_token(
            id_tok,
            g_requests.Request(),
            audience=settings.GOOGLE_OAUTH_CLIENT_ID,
            clock_skew_in_seconds=10
        )
        logger.info("Google login token verified successfully")
        email = info.get('email')
        given_name = info.get('given_name', '')
        family_name = info.get('family_name', '')
        name = info.get('name') or f"{given_name} {family_name}".strip()

        if not email:
            return Response({'detail': 'Invalid id_token: no email'}, status=400)

        user, created = User.objects.get_or_create(
            email=email,
            defaults={'username': email, 'name': name, 'role': 'candidate', 'organization_id': request.query_params.get('organization_id')}
        )
        logger.info("User created or retrieved: %s", user.email)
        # Ensure user has a usable password: generate for newly created users, or if user has no usable password
        generated_password = None
        try:
            logger.info("Checking if password generation is needed for user: %s", user.email)
            if created or not user.has_usable_password():
                generated_password = generate_password(12)
                user.set_password(generated_password)
                # Ensure name is set if available
                if name and not user.name:
                    user.name = name
                user.save()
        except Exception:
            logger.exception("Failed to set generated password for Google OAuth user", extra={"email": email})

        # Send welcome/email with password ONLY when we generated a password for them
        if generated_password:
            try:
                logger.info("Sending welcome email with generated password to: %s", email)
                subject = "Welcome to SkilTechy Learning Platform"
                message = (
                    f"Hi {user.name or 'User'},\n\n"
                    "Your account was created using Google SSO on SkilTechy Learning Platform.\n"
                    f"A temporary password has been generated for you: {generated_password}\n\n"
                    "Please log in and change your password from your profile for security.\n\n"
                    "If you did not request this account, please contact support immediately.\n\n"
                    "Thanks,\nSkilTechy Team"
                )
                html_message = render_to_string('emails/account_google_welcome.html', {
                    'name': user.name or 'User',
                    'email': user.email,
                    'password': generated_password,
                    'login_url': settings.FRONTEND_URL.rstrip('/') + '/login',
                })
                send_mail(
                    subject=subject,
                    message=message,
                    from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', None),
                    recipient_list=[user.email],
                    fail_silently=False,
                    html_message=html_message,
                )
            except Exception:
                logger.exception("Failed to send welcome email with password", extra={"email": email})
        else:
            # Ensure user's name is up-to-date if we didn't set password (existing user)
            if not user.name and name:
                user.name = name
                user.save()


        # Check if user should be disabled (temporary user expired)
        #user.disable_if_expired()

        # Check if user is active
        # if not user.is_active:
        #     return Response({
        #         'detail': 'Your account has been disabled. Please contact support.'
        #     }, status=403)

        # Generate JWT tokens
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)

        return Response({
            'access': access_token,
            'refresh': str(refresh),
            'user': {
                'id': user.id,
                'name': user.name or '',
                'email': user.email,
                'role': user.role,
                'organization_id': user.organization_id,
            }
        })
    except Exception:  # noqa: BLE001
        logger.exception("OAuth callback error")
        return Response({'detail': 'Invalid id_token'}, status=400)





# Send OTP to Email for forget password
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def send_otp(request):
    email = request.data.get('email')
    if not email:
        logger.warning("OTP request validation failed - missing email")
        return Response({'email': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(email=email)
        logger.info("User found for OTP request", extra={"email": email, "user_id": user.id})
    except User.DoesNotExist:
        return Response({'error': 'No user found with this email'}, status=status.HTTP_404_NOT_FOUND)

    otp = random.randint(100000, 999999)

    otp_record, created = OTPVerification.objects.update_or_create(
        email=email,
        defaults={'otp': otp, 'created_at': timezone.now()}
)
    
    logger.info("OTP record created/updated", extra={
        "email": email,
        "user_id": user.id,
        "otp_created": created
    })

    # Send OTP via email
    try:
        send_mail(
            subject='Your Password Reset OTP',
            message=f'Your OTP code is {otp}. It is valid for 10 minutes.',
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            html_message=render_to_string('emails/account_password_reset_otp.html', {
                'otp': otp,
            }),
        )
        logger.info("OTP email sent successfully", extra={"email": email, "user_id": user.id})
    except Exception:
        logger.exception("OTP email sending failed", extra={"email": email, "user_id": user.id})

    return Response({'message': 'OTP sent successfully to your email'})




# Verify OTP for forget password
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def verify_otp(request):
    email = request.data.get('email')
    otp = request.data.get('otp')

    if not email or not otp:
        logger.warning("OTP verification validation failed - missing email or otp", extra={
            "email": email,
            "has_otp": bool(otp)
        })
        return Response({'error': 'Email and OTP are required'}, status=status.HTTP_400_BAD_REQUEST)

    # Find the OTP record
    otp_obj = OTPVerification.objects.filter(email=email, otp=otp).first()

    if not otp_obj:
        return Response({'error': 'Invalid OTP or email'}, status=status.HTTP_400_BAD_REQUEST)

    # Check expiry (valid for 10 minutes)
    if timezone.now() > otp_obj.created_at + timedelta(minutes=10):
        logger.warning("OTP verification failed - OTP expired", extra={
            "email": email,
            "otp_created_at": otp_obj.created_at
        })
        otp_obj.delete()  # delete expired OTP
        return Response({'error': 'OTP expired. Please request a new one.'}, status=status.HTTP_400_BAD_REQUEST)

    # Mark OTP as verified
    otp_obj.verified = True
    otp_obj.save()

    # (Optional) You can mark the user as verified here or return a flag
    return Response({'message': 'OTP verified successfully'})




# Reset Password after OTP verification
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def reset_password(request):
    email = request.data.get('email')
    new_password = request.data.get('new_password')
    confirm_password = request.data.get('confirm_password')

    if not new_password or not confirm_password:
        logger.warning("Password reset validation failed - missing password fields", extra={
            "email": email,
            "has_new_password": bool(new_password),
            "has_confirm_password": bool(confirm_password)
        })
        return Response({'error': 'password and confirm password fields are required'}, status=status.HTTP_400_BAD_REQUEST)

    if new_password != confirm_password:
        return Response({'error': 'Passwords do not match'}, status=status.HTTP_400_BAD_REQUEST)

    otp_obj = OTPVerification.objects.filter(email=email, verified=True).first()

    if not otp_obj:
        return Response({'error': 'OTP verification required'}, status=status.HTTP_403_FORBIDDEN)


    try:
        user = User.objects.get(email=email)
        user.set_password(new_password)
        user.save()
        logger.info("Password updated successfully", extra={"user_id": user.id, "email": email})

        # Delete OTP after password reset
        otp_obj.delete()

        return Response({'message': 'Password reset successful'})
    
    
    except User.DoesNotExist:
        logger.warning("Password reset failed - user not found", extra={"email": email})
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)


# ───────────────────────── Org-admin invite acceptance ─────────────────────────
# Public endpoints that pair with organization.views.invite_admin. The invite
# token is "<uidb64>.<token>" where token = default_token_generator.make_token.
# Because that token bakes in the password hash + last_login, it becomes invalid
# the moment the admin sets their password — i.e. it is single-use.
from django.contrib.auth.tokens import default_token_generator as _token_gen
from django.utils.http import urlsafe_base64_decode as _uid_decode
from rest_framework.permissions import AllowAny as _AllowAny
from rest_framework.views import APIView as _APIView
from rest_framework_simplejwt.tokens import RefreshToken as _RefreshToken


def _load_invite(token):
    """Return the invited User for a valid, unused token, else None."""
    try:
        uidb64, _, tok = (token or "").partition(".")
        if not uidb64 or not tok:
            return None
        uid = _uid_decode(uidb64).decode()
        user = User.objects.filter(pk=uid).first()
        if user and _token_gen.check_token(user, tok):
            return user
        return None
    except Exception:
        return None


class AcceptInviteInfoView(_APIView):
    """GET ?token=... → minimal context so the set-password page can render."""
    permission_classes = [_AllowAny]

    def get(self, request):
        user = _load_invite(request.query_params.get("token", ""))
        if not user:
            return Response({"detail": "This invite link is invalid or has expired."},
                            status=status.HTTP_400_BAD_REQUEST)
        return Response({
            "email": user.email,
            "name": user.full_name,
            "organization": getattr(user.organization, "name", None),
        })


class AcceptInviteView(_APIView):
    """POST {token, password} → set password, activate, return login tokens."""
    permission_classes = [_AllowAny]

    def post(self, request):
        token = request.data.get("token", "")
        password = request.data.get("password", "")
        user = _load_invite(token)
        if not user:
            return Response({"detail": "This invite link is invalid or has expired."},
                            status=status.HTTP_400_BAD_REQUEST)
        if not password or len(password) < 8:
            return Response({"detail": "Password must be at least 8 characters."},
                            status=status.HTTP_400_BAD_REQUEST)

        user.set_password(password)
        user.is_active = True
        user.last_login = timezone.now()  # accepting the invite IS their first login
        user.save()

        refresh = _RefreshToken.for_user(user)
        refresh["role"] = user.role
        refresh["name"] = user.full_name
        refresh["organization_id"] = user.organization_id
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "name": user.full_name,
            "user": {
                "id": user.id,
                "name": user.full_name,
                "email": user.email,
                "role": user.role,
                "organization_id": user.organization_id,
                "is_individual": getattr(user, "is_individual", False),
            },
        })
