"""
WSGI config for online_assessment project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'online_assessment.settings')

application = get_wsgi_application()

# 👇 OpenTelemetry init AFTER Django loads
from online_assessment.startup import init_otel
init_otel()