from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile, File
from django.db import models
from django.utils.translation import gettext_lazy as _


class AccessControlEntry(models.Model):
    """
    Implement a simple Access Control List based on the NFSv4 Access Control Lists standard.
    Not all features are implemented, because they are not needed in the context of django-filer.
    """
    allow = models.BooleanField(
        default=True,
        verbose_name=_("Allow/deny access"),
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        editable=False,
    )
    group = models.ForeignKey(
        'auth.Group',
        null=True,
        editable=False,
    )
    everybody = models.BooleanField(
        default=False,
        editable=False,
    )
    content_type = models.ForeignKey(
        'contenttypes.ContentType',
        editable=False,
        on_delete=models.CASCADE,
    )
    object_uuid = models.UUIDField(
        editable=False,
    )
    inode = models.GenericForeignKey('content_type', 'object_id')

    class Meta:
        verbose_name = _("Access Control Entry")
        verbose_name_plural = _("Access Control Entries")
        indexes = [
            models.Index(fields=['content_type', 'object_uuid']),
        ]
