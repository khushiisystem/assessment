from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from django.views.static import serve
import os

urlpatterns = [
    path('super-admin/', admin.site.urls),  # Change default admin URL
    path('v1/', include('core.urls')),   # Core APIs
    path('v1/', include('AI_assessment.urls')),  # AI Assessment app URLs
    path("v1/api/", include("accounts.urls")),  # Accounts app URLs
    path('v1/api/', include('learning.urls')),
    path('v1/api/mock-interview/', include('mock_interview.urls')), # Mock Interview app URLs
    path('auth/', include('social_django.urls', namespace='social')),
    path('v1/api/', include('core.urls')),          # Core App APIs
    path('v1/api/', include('organization.urls')),  # Organization app URLs
    path('v1/api/interview/', include('premium_ai_interview.urls')),  # Premium AI Interview app URLs
]

DIST_DIR = os.path.join(settings.BASE_DIR, 'core', 'dist')
ASSETS_DIR = os.path.join(DIST_DIR, 'assets')

urlpatterns += [
    # Serve JS/CSS/other assets
    re_path(r'^assets/(?P<path>.*)$', serve, {'document_root': ASSETS_DIR}),
    re_path(r'^(?P<path>.*\.(js|css|json|png|svg|ico))$', serve, {'document_root': DIST_DIR}),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

urlpatterns += [
    re_path(r'^(?!v1/api/).*$', TemplateView.as_view(template_name='index.html')),
]

urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
