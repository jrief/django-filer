import hashlib
import mimetypes
import os
import uuid
from datetime import datetime
from itertools import chain
from pathlib import Path

from django.conf import settings
from django.contrib.staticfiles.storage import staticfiles_storage
from django.core.exceptions import ImproperlyConfigured, ValidationError
from django.core.files.base import ContentFile, File
from django.core.files.storage import default_storage
from django.db import models
from django.urls import NoReverseMatch, reverse
from django.utils import timezone
from django.utils.functional import cached_property
from django.utils.translation import gettext_lazy as _

from filer import settings as filer_settings
from filer.fields.thumbnail import ThumbnailField


class InodeManager(models.Manager):
    @cached_property
    def root_folder(self):
        root_folder, _ = self.get_or_create(parent=None, defaults={'name': "root"})
        return root_folder

    def get_queryset(self):
        return super().get_queryset().select_related('parent')


class InodeMetaModel(models.base.ModelBase):
    _inode_models = {}

    def __new__(cls, *args, **kwargs):
        new_class = super().__new__(cls, *args, **kwargs)
        base_labels = [b._meta.label for b in new_class.mro() if hasattr(b, '_meta')]
        if new_class._meta.abstract is False and 'filer.InodeModel' in base_labels:
            if not new_class.is_folder:
                cls._validate_accept_mime_types(new_class)
            cls._inode_models[new_class._meta.label] = new_class
        return new_class

    def _validate_accept_mime_types(new_class):
        if not hasattr(new_class, 'accept_mime_types'):
            msg = "Attribute accept_mime_types not defined for {}"
            raise ImproperlyConfigured(msg.format(new_class))
        if not isinstance(new_class.accept_mime_types, (list, tuple)):
            msg = "Attribute accept_mime_types must be a list or tuple for {}"
            raise ImproperlyConfigured(msg.format(new_class))
        if not all(isinstance(mime_type, str) for mime_type in new_class.accept_mime_types):
            msg = "Attribute accept_mime_types must be a list of strings for {}"
            raise ImproperlyConfigured(msg.format(new_class))
        for accept_mime_type in new_class.accept_mime_types:
            for other in new_class._inode_models.values():
                if not other.is_folder and accept_mime_type in other.accept_mime_types:
                    msg = "Attribute accept_mime_types {} already defined in {}"
                    raise ImproperlyConfigured(msg.format(accept_mime_type, other))

    @property
    def all_models(self):
        for model in self._inode_models.values():
            yield model

    @property
    def file_models(cls):
        for model in cls._inode_models.values():
            if not model.is_folder:
                yield model


class InodeModel(models.Model, metaclass=InodeMetaModel):
    is_folder = False
    data_fields = ['id', 'name', 'created_at', 'last_modified_at']

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    parent = models.ForeignKey(
        'filer.NextFolder',
        verbose_name=_("Folder"),
        related_name='+',
        editable=False,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='+',
        on_delete=models.SET_NULL,
        editable=False,
        null=True,
        blank=True,
        verbose_name=_("Owner"),
    )
    name = models.CharField(
        max_length=255,
        verbose_name=_("Name"),
    )
    created_at = models.DateTimeField(
        _("Created at"),
        auto_now_add=True,
        editable=False,
    )
    last_modified_at = models.DateTimeField(
        _("Modified at"),
        auto_now=True,
        editable=False,
    )

    class Meta:
        abstract = True

    objects = InodeManager()

    def __str__(self):
        return self.name


class NextFolder(InodeModel):
    is_folder = True
    thumbnail_url = staticfiles_storage.url('filer/icons/folder.svg')

    description = models.TextField(
        null=True,
        blank=True,
        verbose_name=_("Description"),
    )

    class Meta:
        app_label = 'filer'
        verbose_name = _("Folder")
        verbose_name_plural = _("(Next) Folders")
        default_permissions = ['read', 'write']

    def get_children(self, lookup):
        lookup = dict(lookup, parent=self)
        children = [inode_model.objects.filter(**lookup) for inode_model in InodeModel.all_models]
        return chain(*children)


def mimetype_validator(value):
    if not mimetypes.guess_extension(value):
        msg = "'{mimetype}' is not a recognized MIME-Type."
        raise ValidationError(msg.format(mimetype=value))


class FileModelManager(InodeManager):
    def create(self, uploaded_file, **kwargs):
        folder = kwargs.pop('folder')
        kwargs.update(
            parent=folder,
            name=uploaded_file.name,
            mime_type=kwargs.pop('mime_type', uploaded_file.content_type),
            file_size=uploaded_file.size,
        )
        obj = self.model(**kwargs)
        id = str(obj.id)
        filer_public = Path(settings.MEDIA_ROOT) / filer_settings.FILER_STORAGES['public']['main']['UPLOAD_TO_PREFIX']
        upload_dir = filer_public / f'{id[0:2]}/{id[2:4]}/{id}'
        upload_dir.mkdir(parents=True, exist_ok=True)
        file_path = upload_dir / uploaded_file.name
        sha1 = hashlib.sha1()
        with open(file_path, 'wb+') as destination:
            for chunk in uploaded_file.chunks():
                sha1.update(chunk)
                destination.write(chunk)
        if default_storage.size(file_path) != obj.file_size:
            raise IOError("File size mismatch between uploaded file and destination file")
        obj.sha1 = sha1.hexdigest()
        obj.file = Path(file_path).relative_to(default_storage.location)
        obj._for_write = True
        obj.save(force_insert=True, using=self.db)
        folder.refresh_from_db(using=self.db)
        return obj

    def get_model_for(self, mime_type):
        def lookup(mime_type):
            for model in InodeModel.file_models:
                if mime_type in model.accept_mime_types:
                    return model
            return None

        if model := lookup(mime_type):
            return model
        if model := lookup('/'.join((mime_type.split('/')[0], '*'))):
            return model
        return NextFile


class AbstractFileModel(InodeModel):
    accept_mime_types = ['*/*']
    data_fields = InodeModel.data_fields + ['file', 'file_size', 'sha1', 'mime_type', 'original_filename']

    file = models.FilePathField(
        _("File"),
        path=str(settings.MEDIA_ROOT / 'filer_public'),
        null=True,
        blank=True,
        recursive=True,
        max_length=255,
    )
    file_size = models.BigIntegerField(
        _("Size"),
        null=True,
        blank=True,
    )
    sha1 = models.CharField(
        _("sha1"),
        max_length=40,
        blank=True,
        default='',
    )
    mime_type = models.CharField(
        max_length=255,
        help_text="MIME type of uploaded content",
        validators=[mimetype_validator],
        default='application/octet-stream',
    )
    original_filename = models.CharField(
        _("Original filename"),
        max_length=255,
        blank=True,
        null=True,
    )
    thumbnail = ThumbnailField()
    meta_data = models.JSONField(
        default=dict,
        blank=True,
    )

    class Meta:
        abstract = True
        app_label = 'filer'
        verbose_name = _("File")
        verbose_name_plural = _("Files")
        default_permissions = []

    objects = FileModelManager()

    @property
    def folder(self):
        return self.parent

    @classmethod
    def get_thumbnail_url(cls, file_path=None):
        return staticfiles_storage.url('filer/icons/file-unknown.svg')

    @cached_property
    def mime_maintype(self):
        return self.mime_type.split('/')[0]

    @cached_property
    def mime_subtype(self):
        return self.mime_type.split('/')[1]

    def validate_name(self):
        if not self.name:
            self.name = self.original_filename


class NextFile(AbstractFileModel):
    def file_data_changed(self, post_init=False):
        """
        This is called whenever self.file changes (including initial set in __init__).
        MultiStorageFileField has a custom descriptor which calls this function when
        field value is changed.
        Returns True if data related attributes were updated, False otherwise.
        """
        if self._file_data_changed_hint is not None:
            data_changed_hint = self._file_data_changed_hint
            self._file_data_changed_hint = None
            if not data_changed_hint:
                return False
        if post_init and self._file_size and self.sha1:
            # When called from __init__, only update if values are empty.
            # This makes sure that nothing is done when instantiated from db.
            return False
        # cache the file size
        try:
            self._file_size = self.file.size
        except:   # noqa
            self._file_size = None
        # generate SHA1 hash
        try:
            self.generate_sha1()
        except Exception:
            self.sha1 = ''
        return True

    def _move_file(self):
        """
        Move the file from src to dst.
        """
        src_file_name = self.file.name
        dst_file_name = self._meta.get_field('file').generate_filename(
            self, self.original_filename)

        if self.is_public:
            src_storage = self.file.storages['private']
            dst_storage = self.file.storages['public']
        else:
            src_storage = self.file.storages['public']
            dst_storage = self.file.storages['private']

        # delete the thumbnail
        # We are toggling the is_public to make sure that easy_thumbnails can
        # delete the thumbnails
        self.is_public = not self.is_public
        self.file.delete_thumbnails()
        self.is_public = not self.is_public
        # This is needed because most of the remote File Storage backend do not
        # open the file.
        src_file = src_storage.open(src_file_name)
        # Context manager closes file after reading contents
        with src_file.open() as f:
            content_file = ContentFile(f.read())
        # hint file_data_changed callback that data is actually unchanged
        self._file_data_changed_hint = False
        self.file = dst_storage.save(dst_file_name, content_file)
        src_storage.delete(src_file_name)

    def _copy_file(self, destination, overwrite=False):
        """
        Copies the file to a destination files and returns it.
        """

        if overwrite:
            # If the destination file already exists default storage backend
            # does not overwrite it but generates another filename.
            # TODO: Find a way to override this behavior.
            raise NotImplementedError

        src_file_name = self.file.name
        storage = self.file.storages['public' if self.is_public else 'private']

        # This is needed because most of the remote File Storage backend do not
        # open the file.
        src_file = storage.open(src_file_name)
        src_file.open()
        return storage.save(destination, ContentFile(src_file.read()))

    def Xsave(self, *args, **kwargs):
        # check if this is a subclass of "File" or not and set
        # _file_type_plugin_name
        if self.__class__ == File:
            # what should we do now?
            # maybe this has a subclass, but is being saved as a File instance
            # anyway. do we need to go check all possible subclasses?
            pass
        elif issubclass(self.__class__, File):
            self._file_type_plugin_name = self.__class__.__name__
        if self._old_is_public != self.is_public and self.pk:
            self._move_file()
            self._old_is_public = self.is_public
        super().save(*args, **kwargs)

    def Xdelete(self, *args, **kwargs):
        # Delete the model before the file
        super().delete(*args, **kwargs)
        # Delete the file if there are no other Files referencing it.
        if not File.objects.filter(file=self.file.name, is_public=self.is_public).exists():
            self.file.delete(False)

    @property
    def label(self):
        if self.name in ['', None]:
            text = self.original_filename or 'unnamed file'
        else:
            text = self.name
        text = "%s" % (text,)
        return text

    def __lt__(self, other):
        return self.label.lower() < other.label.lower()

    def has_edit_permission(self, request):
        return self.has_generic_permission(request, 'edit')

    def has_read_permission(self, request):
        return self.has_generic_permission(request, 'read')

    def has_add_children_permission(self, request):
        return self.has_generic_permission(request, 'add_children')

    def has_generic_permission(self, request, permission_type):
        """
        Return true if the current user has permission on this
        image. Return the string 'ALL' if the user has all rights.
        """
        user = request.user
        if not user.is_authenticated:
            return False
        elif user.is_superuser:
            return True
        elif user == self.owner:
            return True
        elif self.folder:
            return self.folder.has_generic_permission(request, permission_type)
        else:
            return False

    def get_admin_change_url(self):
        return reverse(
            'admin:{0}_{1}_change'.format(
                self._meta.app_label,
                self._meta.model_name,
            ),
            args=(self.pk,)
        )

    def get_admin_delete_url(self):
        return reverse(
            'admin:{0}_{1}_delete'.format(self._meta.app_label, self._meta.model_name),
            args=(self.pk,))

    @property
    def url(self):
        """
        to make the model behave like a file field
        """
        try:
            r = self.file.url
        except:  # noqa
            r = ''
        return r

    @property
    def canonical_time(self):
        if settings.USE_TZ:
            return int((self.uploaded_at - datetime(1970, 1, 1, 1, tzinfo=timezone.utc)).total_seconds())
        else:
            return int((self.uploaded_at - datetime(1970, 1, 1, 1)).total_seconds())

    @property
    def canonical_url(self):
        url = ''
        if self.file and self.is_public:
            try:
                url = reverse('canonical', kwargs={
                    'uploaded_at': self.canonical_time,
                    'file_id': self.id
                })
            except NoReverseMatch:
                pass  # No canonical url, return empty string
        return url

    @property
    def path(self):
        try:
            return self.file.path
        except:  # noqa
            return ''

    @property
    def size(self):
        return self._file_size or 0

    @property
    def extension(self):
        filetype = os.path.splitext(self.file.name)[1].lower()
        if len(filetype) > 0:
            filetype = filetype[1:]
        return filetype

    @property
    def logical_folder(self):
        """
        if this file is not in a specific folder return the Special "unfiled"
        Folder object
        """
        if not self.folder:
            from .virtualitems import UnsortedImages
            return UnsortedImages()
        else:
            return self.folder

    @property
    def logical_path(self):
        """
        Gets logical path of the folder in the tree structure.
        Used to generate breadcrumbs
        """
        folder_path = []
        if self.folder:
            folder_path.extend(self.folder.get_ancestors())
        folder_path.append(self.logical_folder)
        return folder_path

    @property
    def duplicates(self):
        return File.objects.find_duplicates(self)
