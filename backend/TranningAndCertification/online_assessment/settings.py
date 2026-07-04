import os
from datetime import datetime, timezone
from pathlib import Path
from absl.logging import LOG_DIR
from dotenv import load_dotenv

## Load .env file
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

## Secret Key and Debug
SECRET_KEY = os.getenv("SECRET_KEY")
DEBUG = os.getenv("DEBUG", "False").lower() == "true"

# Allowed Hosts — env-driven; fallback to the real domains (never "*").
ALLOWED_HOSTS = [
    h.strip()
    for h in os.getenv(
        "ALLOWED_HOSTS",
        "assessment.zecdata.com,dev-assessment.zecdata.com,localhost,127.0.0.1,skiltechy.com,skiltechy.in",
    ).split(",")
    if h.strip()
]
CSRF_TRUSTED_ORIGINS = [
    "https://assessment.zecdata.com",
    "http://localhost:3000",
    "http://localhost:8000",
    "https://skiltechy.com",
    "https://skiltechy.in",
]

SITE_URL = os.getenv("SITE_URL")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000/")
PLATFORM_NAME = os.getenv("PLATFORM_NAME", "Online Assessment Platform")

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'core',
    'AI_assessment',
    'rest_framework',
    'widget_tweaks',
    'storages',
    'rest_framework.authtoken',
    'django_filters',
    'social_django',
    'accounts',
    'learning',
    'corsheaders',
    'mock_interview',
    'organization',
    'premium_ai_interview',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'organization.middleware.TenantContextMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'core.usage_enforcement_middleware.UsageEnforcementMiddleware',
    'online_assessment.middleware.OTelMiddleware',
]

# CSRF Configuration: Exempt API endpoints using JWT but protect session-based views
CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_USE_SESSIONS = False

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "https://assessment.zecdata.com",
    "https://dev-assessment.zecdata.com",
    "https://skiltechy.com",
    "https://skiltechy.in",
]

# CORS_ALLOWED_ORIGIN_REGEXES = [
#     r"^http://192\.168\.\d+\.\d+:3000$",
#     r"^http://172\.\d+\.\d+\.\d+:3000$",
#     r"^http://10\.\d+\.\d+\.\d+:3000$",
# ]

CORS_ALLOW_HEADERS = [
    "timezone",
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
    "x-organization-id",
]
CORS_ALLOW_CREDENTIALS = True
# Do NOT allow all origins/headers with credentials — rely on the explicit
# CORS_ALLOWED_ORIGINS + CORS_ALLOW_HEADERS lists above (which already include
# the app domains and the x-organization-id header).

ROOT_URLCONF = 'online_assessment.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [
            BASE_DIR / 'templates',         # Django templates
            BASE_DIR / 'core' / 'dist', # React build (index.html)
        ],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'AI_assessment.context_processors.candidate_sidebar_context',
                'core.context_processors.site_url_context',
                # 'new_core.context_processors.site_url_context',

            ],
        },
    },
]

WSGI_APPLICATION = 'online_assessment.wsgi.application'

# Database
DATABASES = {
    'default': {
        'ENGINE': os.getenv('DB_ENGINE'),
        'NAME': os.getenv('DB_NAME'),
        'USER': os.getenv('DB_USER'),
        'PASSWORD': os.getenv('DB_PASSWORD'),
        'HOST': os.getenv('DB_HOST'),
        'PORT': os.getenv('DB_PORT'),
    }
}

# Password validators
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = os.getenv("TIME_ZONE", "Asia/Kolkata")
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

STATICFILES_DIRS = [
    BASE_DIR / 'core' / 'dist',  # React assets + index.html
]

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

AUTH_USER_MODEL = 'core.User'
# AUTH_USER_MODEL = 'new_core.User'

# LOGIN_URL = '/login/'
# LOGIN_REDIRECT_URL = '/dashboard'
# LOGOUT_REDIRECT_URL = '/login/'

# Django REST Framework
from datetime import timedelta

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        # 'rest_framework_simplejwt.authentication.JWTAuthentication',
        # 'rest_framework.authentication.TokenAuthentication',
        'organization.authentication.TenantJWTAuthentication',
        'organization.authentication.TenantTokenAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 100000,
    # Rate limit for unauthenticated, cost-bearing AI endpoints (TTS/STT/LLM)
    # to curb abuse/DoS/cost. Applied per-view via throttle_classes, not globally.
    'DEFAULT_THROTTLE_RATES': {
        'premium_ai': '60/min',
    },
}

AUTHENTICATION_BACKENDS = [
    'social_core.backends.google.GoogleOAuth2',
    'django.contrib.auth.backends.ModelBackend',
]


# LOGIN_URL = '/admin/login/'
# LOGIN_REDIRECT_URL = '/admin/'
# LOGOUT_REDIRECT_URL = '/admin/'

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    # Update User.last_login on each token obtain (login) so admins can see who
    # has actually signed in. Off by default in SimpleJWT.
    'UPDATE_LAST_LOGIN': True,
}

# Google OAuth2
GOOGLE_OAUTH_CLIENT_ID = os.getenv('SOCIAL_AUTH_GOOGLE_OAUTH2_KEY')
GOOGLE_OAUTH_CLIENT_SECRET = os.getenv('SOCIAL_AUTH_GOOGLE_OAUTH2_SECRET')
GOOGLE_OAUTH_REDIRECT_URI = os.getenv('GOOGLE_OAUTH_REDIRECT_URI')

SOCIAL_AUTH_GOOGLE_OAUTH2_WHITELISTED_DOMAINS = os.environ.get(
    'SOCIAL_AUTH_WHITELISTED',
    'zecdata.com,bestpeers.com'
).split(',')

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Email settings
EMAIL_BACKEND = os.getenv("EMAIL_BACKEND")
EMAIL_HOST = os.getenv("EMAIL_HOST")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", 587))
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "True").lower() == "true"
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL")

# Judge0 API
JUDGE0_API_URL = os.getenv("JUDGE0_API_URL", "https://ce.judge0.com")
JUDGE0_API_KEY = os.getenv("JUDGE0_API_KEY")

JUDGE0_LANGUAGE_MAPPING = {
    "python": 71,   # Python 3.8.1, 34 for Python 3.6.0, 35 for python 3.5.3 ,70 for Python 2.7.17
    "javascript": 63,
    "java": 62,
    "c": 50,
    "cpp": 54,
    "csharp": 51,
    "php": 68,
    "ruby": 72,
    "swift": 83,
    "go": 60,
    "rust": 73,
    "typescript": 74,
    "sqlite": 82,  # SQLite
}

# === SQL Engine Configuration ===
# Choose which SQL flavor to use (options: "sqlite", "mysql", "postgres", etc.)
JUDGE0_SQL_FLAVOR = "sqlite"

# Shortcut / backward compatibility mapping
JUDGE0_LANG_IDS = {
    "sqlite": JUDGE0_LANGUAGE_MAPPING["sqlite"]
}

# === Runtime and Resource Limits ===
JUDGE0_RUN_OPTS = {
    "time_limit_ms": 8000,       # 8 seconds
    "memory_limit_kb": 256_000,  # 256 MB
    "max_sql_len": 100_000,      # Max SQL input size
    "max_rows": 5000,            # Max rows returned for SQL queries
}

# === Derived / Alias Settings ===
JUDGE0_BASE_URL = JUDGE0_API_URL

# File upload limits
DATA_UPLOAD_MAX_MEMORY_SIZE = 52428800  # 50 MB
FILE_UPLOAD_MAX_MEMORY_SIZE = 52428800

# Webhook secret for secure communication
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "")

# Google Cloud Configuration
DEFAULT_GOOGLE_APPLICATION_CREDENTIALS = BASE_DIR.parent / "credentials" / "google-credentials.json"
GOOGLE_CLOUD_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT")
GOOGLE_CLOUD_LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
if not GOOGLE_APPLICATION_CREDENTIALS and DEFAULT_GOOGLE_APPLICATION_CREDENTIALS.exists():
    GOOGLE_APPLICATION_CREDENTIALS = str(DEFAULT_GOOGLE_APPLICATION_CREDENTIALS)
GOOGLE_CREDENTIALS_JSON = os.getenv("GOOGLE_CREDENTIALS_JSON")

# AWS S3 Configuration
USE_S3 = os.getenv("USE_S3", "False").lower() == "true"

if USE_S3:
    # AWS Settings
    AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
    AWS_STORAGE_BUCKET_NAME = os.getenv("AWS_STORAGE_BUCKET_NAME")
    AWS_S3_REGION_NAME = os.getenv("AWS_S3_REGION_NAME", "us-east-1")
    AWS_S3_CUSTOM_DOMAIN = f"{AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com"
    
    # S3 File Storage Settings
    AWS_S3_OBJECT_PARAMETERS = {
        'CacheControl': 'max-age=86400',
    }
    AWS_DEFAULT_ACL = 'public-read'
    AWS_QUERYSTRING_AUTH = False
    
    # Use S3 for media files (videos, images, resumes)
    DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
else:
    # Use local storage
    # DEFAULT_FILE_STORAGE = 'djangopp containing the task must be in INST.core.files.storage.FileSystemStorage'
    pass

# pp containing the task must be in INST
# ─────────────────────────────────────────────────────────────────────
# Razorpay Payment Gateway Configuration
# ─────────────────────────────────────────────────────────────────────
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")
RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")


BASE_DIR = Path(__file__).resolve().parent.parent
LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE_TIMESTAMP = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
DJANGO_LOG_FILE = LOG_DIR / f"django_app_{LOG_FILE_TIMESTAMP}.log"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,

    "formatters": {
        "verbose": {
            "format": (
                "[%(asctime)s] "
                "[%(levelname)s] "
                "[%(name)s] "
                "[%(filename)s:%(lineno)d] "
                "[%(funcName)s] "
                "%(message)s"
            ),
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
    },

    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },

        # File handler (NEW)
        "file": {
            "class": "logging.FileHandler",
            "filename": str(DJANGO_LOG_FILE),
            "mode": "a",
            "formatter": "verbose",
            "encoding": "utf-8",
        },
    },

    "root": {
        "handlers": ["console", "file"],  # 👈 both
        "level": "INFO",
    },

    "loggers": {
        "django": {
            "handlers": ["console", "file"],
            "level": "INFO",
            "propagate": False,
        },
    },
}


# Celery Configuration
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND', 'redis://localhost:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'UTC'

# Celery Beat Settings
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'

# Standalone Celery Service Configuration
# Use "broker" to publish directly to the shared Celery broker, or "http"
# to submit tasks through the standalone service API.
CELERY_SERVICE_PUBLISHER = os.getenv('CELERY_SERVICE_PUBLISHER', 'broker')
CELERY_SERVICE_PATH = os.getenv(
    'CELERY_SERVICE_PATH',
    '/home/dell-l-56/Celery_BackgroundTask/background_tasks',
)
CELERY_SERVICE_URL = os.getenv('CELERY_SERVICE_URL', 'http://localhost:8001')
CELERY_SERVICE_API_KEY = os.getenv('CELERY_SERVICE_API_KEY', '')
CELERY_SERVICE_TIMEOUT = int(os.getenv('CELERY_SERVICE_TIMEOUT', '30'))
CELERY_CALLBACK_BASE_URL = os.getenv('CELERY_CALLBACK_BASE_URL', '')

# ── Celery Configuration ──────────────────────────────────────────
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://127.0.0.1:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://127.0.0.1:6379/0")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "UTC"
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 300  # 5 minutes max per task

# Celery Beat Schedule (periodic tasks)
from celery.schedules import crontab  # noqa: E402

CELERY_BEAT_SCHEDULE = {
    "assign-weekly-assessments": {
        "task": "core.tasks.assign_weekly_assessments_task",
        "schedule": crontab(hour=0, minute=0, day_of_week="monday"),
    },
    "expire-subscriptions-daily": {
        "task": "core.tasks.expire_subscriptions_task",
        "schedule": crontab(hour=1, minute=0),  # Run daily at 1 AM
    },
    "update-expired-assessments": {
        "task": "core.tasks.update_expired_assessments_task",
        "schedule": crontab(minute="*/15"),  # Every 15 minutes
    },
}
