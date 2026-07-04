from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
from datetime import timedelta

# class User(AbstractUser):
#     ROLE_CHOICES = (
#         ('admin', 'Admin'),
#         ('employee', 'Employee'),
#     )
#     username = models.CharField(max_length=150, unique=True)
#     email = models.EmailField(unique=True)
#     name = models.CharField(max_length=200, blank=True)
#     avatar = models.FileField(upload_to='avatars/', blank=True, null=True)
#     profile_title = models.CharField(max_length=200, blank=True)
#     role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='employee')

#     USERNAME_FIELD = 'email'
#     REQUIRED_FIELDS = ['username']

#     def __str__(self) -> str:
#         return self.email



class OTPVerification(models.Model):
    email = models.EmailField()
    otp = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    verified = models.BooleanField(default=False)  # ✅ Add this

    def is_expired(self):
        return timezone.now() > self.created_at + timedelta(minutes=10)
