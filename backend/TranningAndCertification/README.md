# Online Assessment Platform (Django)

A full-featured technical assessment platform for creating assessments, managing candidates, running code (via Judge0), AI-augmented assessments (audio/video, proctoring, TTS), SQL challenges, analytics, and exports.

## Features

- **Authentication & OTP**
  - Candidate registration with OTP verification
  - Login/logout, password reset with OTP
- **Admin Dashboards**
  - Candidate management (add, import, quick assign, bulk delete, export)
  - Question bank (add, import, edit, delete, export)
  - Assessment management (create, edit, assign, duplicate, analytics, print/export)
- **Candidate Experience**
  - Regular and AI assessments, combined listing of upcoming/completed
  - Take, submit, and view results
- **Code Execution**
  - Judge0 integration for multi-language code execution
  - SQL assessments with run and auto-grading
- **AI Assessment (Level 2)**
  - TTS (text-to-speech)
  - Audio/video uploads (supports S3 multipart via presigned URLs)
  - Frame analysis, proctoring incidents
  - Candidate report generation and reminder emails
- **Storage**
  - Local or AWS S3-based file storage (resumes, videos, images)
- **APIs**
  - REST endpoints for answers, code run, AI uploads, proctoring, webhooks
- **Security**
  - Webhook secret support
  - Configurable `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS`

## Tech Stack

- Python, Django 5
- Django REST Framework
- Judge0 CE (remote API)
- AWS S3 via `django-storages` and `boto3` (optional)
- Post-processing/AI libs present: `mediapipe`, `tensorflow`, `librosa`, etc. (feature usage via `AI_assessment` views)
- Gunicorn for production serving

## Project Structure

- `online_assessment/` Django project (settings, urls, wsgi)
- `core/` core app: auth, dashboards, candidates, assessments, results, exports, code run, SQL endpoints
- `AI_assessment/` AI-enhanced assessments: TTS, audio/video, S3 multipart, proctoring, AI admin, candidate views
- `core/static/` static assets
- `core/templates/`, `AI_assessment/templates/` HTML templates
- [.env.example](cci:7://file:///home/dell-l-54/Desktop/TranningAndCertification/.env.example:0:0-0:0) environment sample
- [requirements.txt](cci:7://file:///home/dell-l-54/Desktop/TranningAndCertification/requirements.txt:0:0-0:0) Python dependencies
- [manage.py](cci:7://file:///home/dell-l-54/Desktop/TranningAndCertification/manage.py:0:0-0:0) Django management entry

## Prerequisites

- Python 3.10+ recommended
- A virtual environment tool (e.g., `venv`)
- Judge0 CE base URL (public or self-hosted)
- Optional: AWS S3 bucket and credentials for media storage
- SMTP credentials for email/OTP

## Setup

1. Clone and enter the project:
   - `git clone <repo-url>`
   - `cd TranningAndCertification`

2. Create a virtual environment and install dependencies:
   - `python -m venv .venv`
   - `source .venv/bin/activate` (Linux/macOS)
   - `pip install --upgrade pip`
   - `pip install -r requirements.txt`

3. Configure environment:
   - Copy [.env.example](cci:7://file:///home/dell-l-54/Desktop/TranningAndCertification/.env.example:0:0-0:0) to `.env`
   - Fill required values (see Environment Variables)

4. Initialize database:
   - `python manage.py migrate`
   - `python manage.py createsuperuser` (for admin access)

5. Run development server:
   - `python manage.py runserver`
   - Visit `http://127.0.0.1:8000/`

## Environment Variables

Copy [.env.example](cci:7://file:///home/dell-l-54/Desktop/TranningAndCertification/.env.example:0:0-0:0) to `.env` and set:

- Django
  - `SECRET_KEY` (required)
  - `DEBUG` (True/False)
  - `ALLOWED_HOSTS` (comma-separated)
  - `CSRF_TRUSTED_ORIGINS` (comma-separated, include your site origins)
  - `SITE_URL` (public base URL, used in templates/emails)
  - `TIME_ZONE` (default `Asia/Kolkata`)
- Database
  - `DB_ENGINE` (default `django.db.backends.sqlite3`)
  - `DB_NAME` (default `db.sqlite3`)
- Email (OTP, notifications)
  - `EMAIL_BACKEND` (e.g., `django.core.mail.backends.smtp.EmailBackend`)
  - `EMAIL_HOST`
  - `EMAIL_PORT` (e.g., 587)
  - `EMAIL_USE_TLS` (True/False)
  - `EMAIL_HOST_USER`
  - `EMAIL_HOST_PASSWORD`
  - `DEFAULT_FROM_EMAIL` (e.g., `Online Assessment <noreply@domain.com>`)
- Judge0
  - `JUDGE0_API_URL` (default `https://ce.judge0.com`)
  - `JUDGE0_API_KEY` (if your instance requires one)
- Webhook
  - `WEBHOOK_SECRET` (long random string)
- AWS S3 (optional; set `USE_S3=True` to enable)
  - `USE_S3` (True/False)
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_STORAGE_BUCKET_NAME`
  - `AWS_S3_REGION_NAME` (e.g., `us-east-1`)

## Running Migrations and Static

- Migrate: `python manage.py migrate`
- Collect static (production): `python manage.py collectstatic`
- Admin: after `createsuperuser`, go to `/django-admin/` or your custom admin routes

## URLs Overview

- Core
  - Auth: `/login/`, `/logout/`
  - Dashboards: `/dashboard/`, `/my-admin/dashboard/`, `/candidate-dashboard/`
  - Candidates: `/my-admin/candidates/`, add/import/bulk-delete/export, details, quick-assign
  - Questions: `/my-admin/questions/`, add/import/edit/delete/export
  - Assessments: `/my-admin/assessments/` create/edit/assign/duplicate/detail
  - Results: `/my-admin/results/`, per assessment/candidate, print/export
  - Candidate flow: `/assessment/<id>/take`, `/submit`, `/result`
  - SQL: `/admin/sql/dataset/create/`, `POST /api/sql/run`, `POST /api/sql/grade`
  - APIs: `POST /api/save-answer`, `POST /api/run-code`, `POST /api/proctoring-incident`
  - Webhook: `POST /api/webhook/register_candidate`
  - Registration/OTP: `/register/`, `/verify-otp/<otp_id>`, `/resend-otp/<otp_id>`
  - Password reset: `/forgot-password/`, `/verify-reset-otp/<otp_id>`, `/reset-password/<otp_id>`
  - Profile: `/profile/`, `/change-password/`
- AI Assessment
  - Admin: `/my-admin/ai-assessments/`, create/assign/results/detail/delete, candidate report/reminder
  - Candidate: `/ai-assessment/<id>/introduction`, `/take`, `/submit`, `/result`
  - Combined candidate views: `/candidate/my-assessments/`, `/candidate/completed/`, `/candidate/upcoming/`
  - Uploads/AI: 
    - `POST /api/ai/upload-audio`, `POST /ai-assessment/upload-audio/`
    - `POST /api/ai/upload-video` (multipart), `POST /ai-assessment/upload-introduction-video/`
    - `POST /api/ai/get-presigned-url`, `POST /api/ai/get-presigned-url-intro`
    - `POST /api/ai/upload-video-chunk`, `POST /api/ai/complete-multipart-upload`
    - `POST /ai-assessment/upload-screenshot/`
    - `POST /ai-assessment/analyze-frame/`
    - `POST /api/ai/tts` and `/ai-assessment/tts/`
    - `POST /ai-assessment/save-proctoring-incident/`
    - `POST /ai-assessment/save-answer/`

Note: Some endpoints require authentication. CSRF applies to session-auth flows.

## Judge0 Integration

- `JUDGE0_API_URL` configures the base endpoint.
- Default language IDs include Python, JS, Java, C/C++, C#, PHP, Ruby, Swift, Go, Rust, TypeScript, and SQLite.
- SQL flavor default: `sqlite` (config in settings).
- Resource limits configurable via settings (time, memory, rows).

## Storage

- If `USE_S3=True`: files saved to S3 (`storages.backends.s3boto3.S3Boto3Storage`).
- If `USE_S3=False`: local filesystem storage.
- Static files served from `core/static` in development.
- For production, serve static via CDN/reverse proxy and ensure `collectstatic` is run.

## Emails and OTP

- Requires working SMTP. Configure the email environment variables.
- OTP flows used for registration and password reset.

## Deployment

- Gunicorn is included in requirements.
- Typical production stack:
  - Reverse proxy (Nginx) -> Gunicorn -> Django
  - `DEBUG=False`, proper `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS`
  - Static collected (`collectstatic`)
  - Database tuned/provisioned (SQLite default; consider Postgres/MySQL for scale)
  - S3 enabled for media (`USE_S3=True`)

## Development Tips

- Enable `DEBUG=True` only locally.
- Use `.env` for secrets; never commit `.env`.
- Logs and temp artifacts are gitignored.
- SQL and code run endpoints may require internet access to Judge0.

## License

Add your chosen license file and reference it here.

## Acknowledgements

- Judge0 CE
- Django & DRF
- AWS S3 via django-storagess
