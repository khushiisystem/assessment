from django.conf import settings

def site_url_context(request):
    return {
        'SITE_URL': settings.SITE_URL
    }
