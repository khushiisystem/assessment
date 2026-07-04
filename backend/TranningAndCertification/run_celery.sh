#!/bin/bash
# Script to run Celery worker for AI Assessment background tasks

# Activate virtual environment
source zdenv/bin/activate

# Set Django settings
export DJANGO_SETTINGS_MODULE=online_assessment.settings

# Run Celery worker
celery -A online_assessment worker --loglevel=info --concurrency=4