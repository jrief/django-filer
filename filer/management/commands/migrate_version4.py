from pathlib import Path

from PIL import Image

from django.core.management.base import BaseCommand
from django.core.files.storage import default_storage

from filer.models.nextmodels import NextFile
from filer.contrib.image.models import ImageModel


class Command(BaseCommand):
    help = "Iterates over all Pages models and populate the search index."

    def handle(self, verbosity, *args, **options):
        self.verbosity = verbosity
        self.stdout.write(f"Migrate to version 4")
        for inode in ImageModel.objects.all():
            image = Image.open(default_storage.open(inode.file))
            inode.file_name = Path(inode.file).name
            inode.width = image.width
            inode.height = image.height
            inode.save()

