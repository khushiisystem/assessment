from django.db import models
from django.utils.text import slugify

from .managers import TenantManager


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Organization(TimeStampedModel):
    ORGANIZATION_TYPE_CHOICES = [
        ("Institute", "Institute"),
        ("Company", "Company"),
        ("Other", "Other"),
    ]
    STATUS_CHOICES = [
        ("Active", "Active"),
        ("Inactive", "Inactive"),
    ]

    name = models.CharField(max_length=255, unique=True)
    legal_name = models.CharField(max_length=255, blank=True, null=True)
    short_name = models.CharField(max_length=50, blank=True, null=True)
    organization_type = models.CharField(
        max_length=50,
        choices=ORGANIZATION_TYPE_CHOICES,
        default="Other",
    )
    description = models.TextField(blank=True, null=True)
    logo_url = models.URLField(blank=True, null=True)
    founded_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Active")
    primary_email = models.EmailField(blank=True, null=True)
    secondary_email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=15, blank=True, null=True)
    alternate_phone = models.CharField(max_length=15, blank=True, null=True)
    toll_free = models.CharField(max_length=20, blank=True, null=True)
    website = models.URLField(blank=True, null=True)
    linkedin = models.URLField(blank=True, null=True)
    twitter = models.URLField(blank=True, null=True)
    facebook = models.URLField(blank=True, null=True)
    instagram = models.URLField(blank=True, null=True)
    youtube = models.URLField(blank=True, null=True)
    slug = models.SlugField(max_length=255, unique=True, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    candidate_limit = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Max number of candidates this organization can invite. Null = unlimited.",
    )

    class Meta:
        ordering = ["name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        # Keep backward compatibility for code still relying on is_active.
        self.is_active = self.status == "Active"
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class TenantModel(models.Model):
    organization = models.ForeignKey(
        "organization.Organization",
        on_delete=models.CASCADE,
        related_name="%(app_label)s_%(class)s_set",
        db_index=True,
        null=True,
        blank=True,
    )

    objects = TenantManager()

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        # Auto-assign the creator's organization when it wasn't set explicitly,
        # so tenant data (questions, assessments, courses, ...) always belongs
        # to the org of whoever created it. Guards keep existing behaviour:
        #   - explicit organization always wins (we only fill when unset);
        #   - super-admin context stays null = global/shared content;
        #   - no tenant context (migrations, background tasks) stays null.
        if self.organization_id is None:
            try:
                from organization.context import (
                    current_organization_id,
                    current_user_is_super_admin,
                )
                if not current_user_is_super_admin.get():
                    org_id = current_organization_id.get()
                    if org_id is not None:
                        self.organization_id = org_id
            except Exception:
                # Never let tenant inference break a save.
                pass
        super().save(*args, **kwargs)
