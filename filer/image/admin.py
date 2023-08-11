from django.contrib import admin
from django.template.response import TemplateResponse

from filer.admin.nextadmin import FileAdmin
from filer.image.models import ImageModel


@admin.register(ImageModel)
class ImageAdmin(FileAdmin):
    pass