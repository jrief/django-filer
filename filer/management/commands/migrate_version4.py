from pathlib import Path

from PIL import Image

from django.core.management.base import BaseCommand

from filer.models.filemodels import File, Folder
from filer.models.imagemodels import Image as ImageModel
from filer.models.nextmodels import NextFile, NextFolder
from filer.contrib.image.models import ImageModel as NextImage
from filer.utils.loader import load_model


# ImageModel = load_model(filer_settings.FILER_IMAGE_MODEL)


class Command(BaseCommand):
    help = "Iterates over all Pages models and populate the search index."

    def handle(self, verbosity, *args, **options):
        self.verbosity = verbosity
        self.stdout.write(f"Migrate to version 4")
        self.forward()

    def forward(self):
        for v3_folder in Folder.objects.filter(parent__isnull=True):
            self.migrate_folder(v3_folder, NextFolder.objects.root_folder)

    def migrate_folder(self, v3_folder, v4_parent):
        try:
            v4_folder = next(v4_parent.listdir(name=v3_folder.name))
        except StopIteration:
            v4_folder = NextFolder.objects.create(
                name=v3_folder.name,
                parent=v4_parent,
                created_at=v3_folder.created_at,
                last_modified_at=v3_folder.modified_at,
                owner_id=v3_folder.owner_id,
            )
            self.stdout.write(f"Create folder: {v4_folder}")

        for v3_file in v3_folder.files.all():
            if isinstance(v3_file, ImageModel):
                self.migrate_image(v3_file, v4_folder)
            else:
                self.migrate_file(v3_file, v4_folder)

        for child in v3_folder.children.all():
            self.migrate_folder(child, v4_folder)

    def migrate_file(self, v3_file, v4_parent):
        path = Path(v3_file.file.name)
        inode_id = path.parent.stem
        try:
            v4_file = next(v4_parent.listdir(id=inode_id))
        except StopIteration:
            NextFile.objects.create(
                id=inode_id,
                name=v3_file.name if v3_file.name else v3_file.original_filename,
                file_name=path.name,
                parent=v4_parent,
                created_at=v3_file.uploaded_at,
                last_modified_at=v3_file.modified_at,
                sha1=v3_file.sha1,
                mime_type=v3_file.mime_type,
                file_size=v3_file._file_size,
                owner_id=v3_file.owner_id,
            )
        else:
            if v3_file.modified_at > v4_file.last_modified_at:
                v4_file.name = v3_file.name if v3_file.name else v3_file.original_filename
                v4_file.file_name = path.name
                v4_file.last_modified_at = v3_file.modified_at
                v4_file.sha1 = v3_file.sha1
                v4_file.mime_type = v3_file.mime_type
                v4_file.file_size = v3_file._file_size
                v4_file.owner_id = v3_file.owner_id
                v4_file.save()

    def migrate_image(self, v3_image, v4_parent):
        path = Path(v3_image.file.name)
        inode_id = path.parent.stem
        try:
            v4_image = next(v4_parent.listdir(id=inode_id))
        except StopIteration:
            NextImage.objects.create(
                id=inode_id,
                name=v3_image.name if v3_image.name else v3_image.original_filename,
                file_name=path.name,
                parent=v4_parent,
                created_at=v3_image.uploaded_at,
                last_modified_at=v3_image.modified_at,
                sha1=v3_image.sha1,
                mime_type=v3_image.mime_type,
                file_size=v3_image._file_size,
                owner_id=v3_image.owner_id,
                width=v3_image.width,
                height=v3_image.height,
            )
            v4_image.save()
        else:
            if v3_image.modified_at > v4_image.last_modified_at:
                v4_image.name = v3_image.name if v3_image.name else v3_image.original_filename
                v4_image.file_name = path.name
                v4_image.last_modified_at = v3_image.modified_at
                v4_image.sha1 = v3_image.sha1
                v4_image.mime_type = v3_image.mime_type
                v4_image.file_size = v3_image._file_size
                v4_image.owner_id = v3_image.owner_id
                v4_image.width = v3_image.width
                v4_image.height = v3_image.height
                v4_image.save()
