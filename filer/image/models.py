from django.core.files.storage import default_storage
from django.db import models
from django.utils.translation import gettext_lazy as _

from filer.models.nextmodels import AbstractFileModel


class ImageModel(AbstractFileModel):
    accept_mime_types = ['image/jpeg', 'image/webp', 'image/png', 'image/gif']

    foo = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        app_label = 'filer'
        # proxy = True
        verbose_name = _('Image')
        verbose_name_plural = _('Images')

    @classmethod
    def get_thumbnail_url(cls, file_path=None):
        # TODO: create a real thumbnail
        return default_storage.url(file_path)
