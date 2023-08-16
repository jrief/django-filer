from django.db import models


class ThumbnailField(models.Field):
    """
    A proxy field that returns the thumbnail url for a given file.
    This is required to perform thumbnailing when accessing the queryset using F('thumbnail').
    """
    def __init__(self, *args, **kwargs):
        kwargs['editable'] = False
        super().__init__(*args, **kwargs)

    def from_db_value(self, value, *args):
        return self.model.get_thumbnail_url(value)

    def to_python(self, value):
        return value

    def get_attname_column(self):
        attname = self.get_attname()
        return attname, 'file'

    def contribute_to_class(self, cls, name, private_only=True):
        super().contribute_to_class(cls, name, private_only)
