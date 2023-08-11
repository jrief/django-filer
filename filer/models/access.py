from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
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
        on_delete=models.CASCADE,
        null=True,
        editable=False,
    )
    group = models.ForeignKey(
        'auth.Group',
        on_delete=models.CASCADE,
        null=True,
        editable=False,
    )
    everybody = models.BooleanField(
        default=False,
        editable=False,
    )
    content_type = models.ForeignKey(
        'contenttypes.ContentType',
        on_delete=models.CASCADE,
        editable=False,
    )
    object_uuid = models.UUIDField(
        editable=False,
    )
    inode = GenericForeignKey('content_type', 'object_uuid')

    class Meta:
        verbose_name = _("Access Control Entry")
        verbose_name_plural = _("Access Control Entries")
        indexes = [
            models.Index(fields=['content_type', 'object_uuid']),
        ]
