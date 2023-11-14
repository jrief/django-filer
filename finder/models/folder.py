from django.conf import settings
from django.contrib.staticfiles.storage import staticfiles_storage
from django.core.exceptions import ValidationError
from django.db import models
from django.utils.functional import cached_property
from django.utils.translation import gettext, gettext_lazy as _

from tree_queries.query import TreeManager, TreeQuerySet

from .inode import InodeModel, InodeManagerMixin


class FolderModelManager(InodeManagerMixin, TreeManager):
    @cached_property
    def root_folder(self):
        root_folder, _ = self.get_or_create(parent=None, name='root')
        return root_folder

    def get_trash_folder(self, owner):
        trash_folder, _ = self.get_or_create(parent=None, owner=owner, name='__trash__')
        return trash_folder


class FolderModel(InodeModel):
    is_folder = True

    class Meta:
        verbose_name = _("Folder")
        verbose_name_plural = _("Folders")
        default_permissions = ['read', 'write']
        unique_together = [('parent', 'name')]

    objects = FolderModelManager()

    @property
    def folder(self):
        return self

    @property
    def num_children(self):
        num_children = sum(inode_model.objects.filter(parent=self).count() for inode_model in InodeModel.all_models)
        return num_children

    @property
    def is_root(self):
        return self.__class__.objects.root_folder.id == self.id

    @property
    def is_trash(self):
        return self.parent is None and self.name == '__trash__'

    @property
    def Xdecendants(self):
        """
        Returns a queryset of all decendants of this folder.
        """
        return self.__class__.objects.filter(parent=self)

    @cached_property
    def summary(self):
        return "({}, {})".format(self.num_children, gettext("items"))

    def get_download_url(self):
        return None

    def get_thumbnail_url(self):
        return staticfiles_storage.url('filer/icons/folder.svg')

    def listdir(self, **lookup):
        return self._meta.model.objects.filter_inodes(parent=self, **lookup)

    def copy_to(self, folder, **kwargs):
        """
        Copies the folder to a destination folder and returns it.
        """
        kwargs.setdefault('name', self.name)
        kwargs.setdefault('owner', self.owner)
        kwargs.update(parent=folder)
        obj = self._meta.model.objects.create(**kwargs)
        for inode in self.listdir():
            inode.copy_to(obj, owner=obj.owner)
        return obj

    def validate_constraints(self):
        super().validate_constraints()
        parent = self.parent
        while parent is not None:
            if parent.id == self.id:
                msg = gettext("A parent folder can not become the descendant of a destination folder.")
                raise ValidationError(msg)
            parent = parent.parent
        if next(self.parent.listdir(name=self.name), None):
            msg = gettext("Folder named “{name}” already exists in destination folder.")
            raise ValidationError(msg.format(name=self.name))


class PinnedFolder(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='+',
        on_delete=models.CASCADE,
        editable=False,
    )
    folder = models.ForeignKey(
        FolderModel,
        related_name='pinned_folders',
        on_delete=models.CASCADE,
        editable=False,
    )
    created_at = models.DateTimeField(
        _("Created at"),
        auto_now_add=True,
        editable=False,
    )
