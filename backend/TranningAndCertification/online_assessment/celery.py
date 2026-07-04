import os
from celery import Celery
from celery.schedules import crontab

# Set the default Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'online_assessment.settings')

app = Celery('online_assessment')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps.
app.autodiscover_tasks()

# Define periodic tasks
app.conf.beat_schedule = {
    # Add any periodic tasks here if needed
}

@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')