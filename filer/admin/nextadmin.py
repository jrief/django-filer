from django.contrib import admin
from django.contrib.admin.utils import unquote
from django.contrib.staticfiles.storage import staticfiles_storage
from django.forms.widgets import Media
from django.http.response import HttpResponseRedirect
from django.template.response import TemplateResponse
from django.urls import reverse

from filer.models.nextmodels import NextFolder, NextFile


@admin.register(NextFolder)
class FolderAdmin(admin.ModelAdmin):
    _inode_cache, _model_admin_cache = {}, {}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._model_admin_cache
        self._inode_cache

    def Xhas_add_permission(self, request):
        return False

    @property
    def media(self):
        return Media(
            css={'all': ['admin/filer/css/FilerAdmin.css']},
            js=['admin/filer/js/filer.js'],
        )

    def changelist_view(self, request, extra_context=None):
        # always redirect the list view to the detail view of the root folder
        start_folder = NextFolder.objects.root_folder
        url = reverse('admin:filer_nextfolder_change', args=(start_folder.pk,))
        return HttpResponseRedirect(url)

    def change_view(self, request, object_id, **kwargs):
        object_id = unquote(object_id)
        inode_obj = self.get_object(request, object_id)
        if inode_obj is None:
            return self._get_obj_does_not_exist_redirect(request, self.model._meta, object_id)
        if inode_obj.is_folder:
            return super().change_view(request, object_id, **kwargs)

        # inode_obj is a file and hence we look for the specialized model admin
        model_admin = self.get_model_admin(inode_obj.mime_type)
        return model_admin.change_view(request, object_id, **kwargs)

    def render_change_form(self, request, context, add=False, change=False, form_url='', obj=None):
        folder_template = 'admin/filer/next/folder.html'
        icon_unknown = 'filer/icons/file-unknown.svg'
        children_data = []
        for child_data in obj.children_data:
            icon_url = staticfiles_storage.url(child_data.get('icon_path', icon_unknown))
            children_data.append(dict(
                child_data,
                url=reverse('admin:filer_nextfolder_change', args=(child_data['id'],)),
                thumbnail=icon_url,
            ))
        context.update(folder_data={
            'children': children_data,
        })
        return TemplateResponse(
            request,
            folder_template,
            context,
        )

    def get_object(self, request, object_id, from_field=None):
        if inode_obj := self._inode_cache.get(object_id):
            return inode_obj
        for model in self.model._inode_models.values():
            try:
                inode_obj = model.objects.get(id=object_id)
                self._inode_cache[object_id] = inode_obj
                return inode_obj
            except model.DoesNotExist:
                pass

    def get_model_admin(self, mime_type):
        if model_admin := self._model_admin_cache.get(mime_type):
            return model_admin
        for model, model_admin in self.admin_site._registry.items():
            if model._meta.app_label == 'filer':
                if mime_type in getattr(model, 'accept_mime_types', ()):
                    self._model_admin_cache[mime_type] = model_admin
                    break
        else:
            main_mime_type = '/'.join((mime_type.split('/')[0], '*'))
            for model, model_admin in self.admin_site._registry.items():
                if model._meta.app_label == 'filer':
                    if main_mime_type in getattr(model, 'accept_mime_types', ()):
                        self._model_admin_cache[mime_type] = model_admin
                        break
            else:
                # fallback to the default file admin
                self._model_admin_cache[mime_type] = self.admin_site._registry.get(NextFile)
        return self._model_admin_cache[mime_type]


@admin.register(NextFile)
class FileAdmin(admin.ModelAdmin):
    fields = ['file', 'name', 'original_filename']

    def get_model_perms(self, *args, **kwargs):
        """Prevent showing up in the admin index."""
        return {}

    def render_change_form(self, request, context, add=False, change=False, form_url='', obj=None):
        folder_template = 'admin/filer/next/folder.html'
        return TemplateResponse(
            request,
            folder_template,
            context,
        )
