import json

from django.contrib import admin
from django.contrib.admin.utils import unquote
from django.db.models.expressions import F, Value
from django.db.models.fields import BooleanField
from django.forms.widgets import Media
from django.http.response import (
    HttpResponse, HttpResponseBadRequest, HttpResponseNotFound, HttpResponseRedirect, JsonResponse
)
from django.middleware.csrf import get_token
from django.template.response import TemplateResponse
from django.urls import path, reverse

from filer.models.nextmodels import InodeModel, NextFolder, NextFile


@admin.register(NextFolder)
class FolderAdmin(admin.ModelAdmin):
    _model_admin_cache = {}

    def __init__(self, *args, **kwargs):
        print('FolderAdmin.__init__')
        super().__init__(*args, **kwargs)
        self._model_admin_cache

    @property
    def media(self):
        return Media(
            css={'all': ['admin/filer/css/FilerAdmin.css']},
            js=['admin/filer/js/filer.js'],
        )

    def get_urls(self):
        urls = [
            path(
                '<uuid:folder_id>/fetch',
                self.admin_site.admin_view(self.fetch_inodes),
                name='filer_fetch_inodes',
            ),
            path(
                '<uuid:folder_id>/upload',
                self.admin_site.admin_view(self.upload_files),
                name='filer_upload_files',
            ),
            path(
                '<uuid:folder_id>/move',
                self.admin_site.admin_view(self.move_inodes),
                name='filer_move_inodes',
            ),
            path(
                '<uuid:folder_id>/add_folder',
                self.admin_site.admin_view(self.add_folder),
                name='filer_add_folder',
            ),
        ]
        urls.extend(super().get_urls())
        return urls

    def has_add_permission(self, request):
        return False

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
        context.update(folder_data=dict(
            children=self.get_children_data(obj),
            # url=reverse('admin:filer_nextfolder_change', args=(obj.id,)),
            fetch_inodes_url=reverse('admin:filer_fetch_inodes', args=(obj.id,)),
            upload_files_url=reverse('admin:filer_upload_files', args=(obj.id,)),
            move_inodes_url=reverse('admin:filer_move_inodes', args=(obj.id,)),
            add_folder_url=reverse('admin:filer_add_folder', args=(obj.id,)),
            parent_url=reverse('admin:filer_nextfolder_change', args=(obj.parent_id,)) if obj.parent_id else None,
            name=obj.name,
            csrf_token=get_token(request),
        ))
        return TemplateResponse(
            request,
            folder_template,
            context,
        )

    def get_object(self, request, object_id, from_field=None):
        for model in InodeModel.all_models:
            try:
                return model.objects.get(id=object_id)
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

    def get_children_data(self, folder):
        children_data = []
        for inode_model in InodeModel.all_models:
            data_fields = inode_model.data_fields + ['owner_name', 'is_folder', 'thumbnail_url']
            children_data.extend(
                inode_model.objects.select_related('owner')
                .filter(parent=folder)
                .annotate(owner_name=F('owner__username'))
                .annotate(is_folder=Value(inode_model.is_folder, output_field=BooleanField()))
                .annotate(thumbnail_url=Value(NextFolder.thumbnail_url) if inode_model.is_folder else F('thumbnail'))
                .values(*data_fields)
            )
        for child_data in children_data:
            child_data['url'] = reverse('admin:filer_nextfolder_change', args=(child_data['id'],))
        return children_data

    def fetch_inodes(self, request, folder_id):
        if not (folder := self.get_object(request, folder_id)):
            return HttpResponseNotFound(f"Folder {folder_id} not found.")
        return JsonResponse({'inodes': self.get_children_data(folder)})

    def upload_files(self, request, folder_id):
        if request.method != 'POST':
            return HttpResponseBadRequest('Only POST requests are allowed.')
        if not (folder := self.get_object(request, folder_id)):
            return HttpResponseNotFound(f"Folder {folder_id} not found.")
        if request.content_type == 'multipart/form-data' and 'upload_file' in request.FILES:
            model = NextFile.objects.get_model_for(request.FILES['upload_file'].content_type)
            new_file = model.objects.create(
                request.FILES['upload_file'],
                folder=folder,
                owner=request.user,
            )
        return HttpResponse(f"Uploaded {new_file.name} successfully.")

    def move_inodes(self, request, folder_id):
        if request.method != 'POST':
            return HttpResponseBadRequest(f"Method {request.method} not allowed. Only POST requests are allowed.")
        if request.content_type != 'application/json':
            return HttpResponseBadRequest(f"Invalid content-type {request.content_type}. Only application/json is allowed.")

        body = json.loads(request.body)
        source_folder = self.get_object(request, folder_id)
        if not source_folder:
            return HttpResponseNotFound(f"Folder {folder_id} not found.")
        target_folder = self.get_object(request, body['target_folder'])
        if not target_folder:
            return HttpResponseNotFound(f"Folder {body['target_folder']} not found.")
        for inode in source_folder.get_children({'id__in': body['moved_inodes']}):
            inode.parent = target_folder
            inode.save(update_fields=['parent'])
        return JsonResponse({'inodes': self.get_children_data(source_folder)})

    def add_folder(self, request, folder_id):
        if request.method != 'POST':
            return HttpResponseBadRequest(f"Method {request.method} not allowed. Only POST requests are allowed.")
        if request.content_type != 'application/json':
            return HttpResponseBadRequest(f"Invalid content-type {request.content_type}. Only application/json is allowed.")

        body = json.loads(request.body)
        parent_folder = self.get_object(request, folder_id)
        if not parent_folder:
            return HttpResponseNotFound(f"Folder {folder_id} not found.")
        new_folder = NextFolder.objects.create(
            name=body['name'],
            parent=parent_folder,
            owner=request.user,
        )
        return JsonResponse({'new_folder': dict(
            id=new_folder.id,
            name=new_folder.name,
            url=reverse('admin:filer_nextfolder_change', args=(new_folder.id,)),
            owner_name=new_folder.owner.username,
            is_folder=True,
            thumbnail_url=NextFolder.thumbnail_url,
        )})


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
