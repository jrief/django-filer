from django.contrib import admin
from django.template.response import TemplateResponse

from finder.models.file import FileModel
from .inode import InodeAdmin


@admin.register(FileModel)
class FileAdmin(InodeAdmin):
    fields = ['name']

    def get_model_perms(self, *args, **kwargs):
        """Prevent showing up in the admin index."""
        return {}

    def Xrender_change_form(self, request, context, add=False, change=False, form_url='', obj=None):
        folder_template = 'admin/finder/next/folder.html'
        return TemplateResponse(
            request,
            folder_template,
            context,
        )
