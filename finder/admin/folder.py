import json

from django.contrib import admin
from django.contrib.admin.utils import unquote
from django.core.exceptions import ValidationError

from django.forms.widgets import Media
from django.http.response import (
    HttpResponse, HttpResponseBadRequest, HttpResponseNotFound, HttpResponseRedirect, JsonResponse
)
from django.middleware.csrf import get_token
from django.template.response import TemplateResponse
from django.urls import path, reverse
from django.utils.translation import gettext, gettext_lazy as _

from finder.models.file import InodeModel, FileModel
from finder.models.folder import FolderModel, PinnedFolder

from .inode import InodeAdmin

@admin.register(FolderModel)
class FolderAdmin(InodeAdmin):
    folder_template = 'admin/finder/folder.html'
    _model_admin_cache = {}
    _legends = {
        'name': _("Name"),
        'owner_name': _("Owner"),
        'details': _("Details"),
        'created_at': _("Created at"),
        'mime_type': _("Mime type"),
    }

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
                '<uuid:folder_id>/update',
                self.admin_site.admin_view(self.update_inode),
                name='filer_update_inode',
            ),
            path(
                '<uuid:folder_id>/copy',
                self.admin_site.admin_view(self.copy_inodes),
                name='filer_copy_inodes',
            ),
            path(
                '<uuid:folder_id>/move',
                self.admin_site.admin_view(self.move_inodes),
                name='filer_move_inodes',
            ),
            path(
                '<uuid:folder_id>/delete',
                self.admin_site.admin_view(self.delete_inodes),
                name='filer_delete_inodes',
            ),
            path(
                'erase_trash_folder',
                self.admin_site.admin_view(self.erase_trash_folder),
                name='filer_erase_trash_folder',
            ),
            path(
                '<uuid:folder_id>/toggle_pin',
                self.admin_site.admin_view(self.toggle_pin),
                name='filer_toggle_pin',
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
        # always redirect the list view to the detail view of either the last used, ot the root folder
        fallback_folder = self.get_fallback_folder(request)
        change_url = reverse('admin:finder_foldermodel_change', args=(fallback_folder.id,))
        return HttpResponseRedirect(change_url)

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
        trash_folder = FolderModel.objects.get_trash_folder(owner=request.user)
        favorite_folders = self.get_favorite_folders(request, obj)
        context.update(
            breadcrumbs=self.get_breadcrumbs(request, obj),
            folder_settings=dict(
                folder_id=obj.id,
                name=obj.name,
                base_url=reverse('admin:finder_foldermodel_changelist'),
                ancestors=self.get_ancestors(request, obj),
                favorite_folders=favorite_folders,
                legends=self._legends,
                csrf_token=get_token(request),
            )
        )
        if trash_folder.id != obj.id:
            context['folder_settings'].update(
                is_root=obj.is_root,
                is_trash=False,
                parent_url=reverse('admin:finder_foldermodel_change', args=(obj.parent_id,)) if obj.parent_id else None,
            )
            if not obj.is_root and not next(filter(lambda f: f['id'] == obj.id and f.get('is_pinned'), favorite_folders), None):
                request.session['finder_last_folder_id'] = str(obj.id)
        else:
            context['folder_settings'].update(
                is_root=False,
                is_trash=True,
            )
        return TemplateResponse(
            request,
            self.folder_template,
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
            if model._meta.app_label == 'finder':
                if mime_type in getattr(model, 'accept_mime_types', ()):
                    self._model_admin_cache[mime_type] = model_admin
                    break
        else:
            main_mime_type = '/'.join((mime_type.split('/')[0], '*'))
            for model, model_admin in self.admin_site._registry.items():
                if model._meta.app_label == 'finder':
                    if main_mime_type in getattr(model, 'accept_mime_types', ()):
                        self._model_admin_cache[mime_type] = model_admin
                        break
            else:
                # fallback to the default file admin
                self._model_admin_cache[mime_type] = self.admin_site._registry.get(FileModel)
        return self._model_admin_cache[mime_type]

    def fetch_inodes(self, request, folder_id):
        if not (current_folder := self.get_object(request, folder_id)):
            return HttpResponseNotFound(f"Folder {folder_id} not found.")
        sorting = request.COOKIES.get('django-finder-sorting')
        if query := request.GET.get('q'):
            search_realm = request.COOKIES.get('django-finder-search-realm')
            starting_folder = FolderModel.objects.root_folder if search_realm == 'everywhere' else current_folder
            inodes = self.search_for_inodes(starting_folder, query, sorting=sorting)
        else:
            inodes = self.get_inodes(current_folder, sorting=sorting)
        return JsonResponse({
            'inodes': inodes,
        })

    def search_for_inodes(self, starting_folder, query, sorting=None):
        def traverse(folder):
            for inode in folder.listdir():
                if inode.is_folder:
                    yield from traverse(inode)
            yield folder

        inodes = []
        lookup = {'name__icontains': query}
        for folder in traverse(starting_folder):
            inodes.extend(self.get_inodes(folder, sorting=sorting, **lookup))
        return inodes

    def upload_files(self, request, folder_id):
        if request.method != 'POST':
            return HttpResponseBadRequest(f"Method {request.method} not allowed. Only POST requests are allowed.")
        if not (folder := self.get_object(request, folder_id)):
            return HttpResponseNotFound(f"Folder {folder_id} not found.")
        if request.content_type == 'multipart/form-data' and 'upload_file' in request.FILES:
            model = FileModel.objects.get_model_for(request.FILES['upload_file'].content_type)
            new_file = model.objects.create_from_upload(
                request.FILES['upload_file'],
                folder=folder,
                owner=request.user,
            )
        return HttpResponse(f"Uploaded {new_file.name} successfully.")

    def check_for_valid_post_request(self, request, folder_id):
        if request.method != 'POST':
            return HttpResponseBadRequest(f"Method {request.method} not allowed. Only POST requests are allowed.")
        if request.content_type != 'application/json':
            return HttpResponseBadRequest(f"Invalid content-type {request.content_type}. Only application/json is allowed.")
        if self.get_object(request, folder_id) is None:
            return HttpResponseNotFound(f"Folder {folder_id} not found.")

    def update_inode(self, request, folder_id):
        if response := self.check_for_valid_post_request(request, folder_id):
            return response
        body = json.loads(request.body)
        try:
            obj = self.get_object(request, body['id'])
        except (InodeModel.DoesNotExist, KeyError):
            return HttpResponseNotFound(f"Inode(id={body.get('id', '<missing>')}) not found.")
        current_folder = self.get_object(request, folder_id)
        if next(current_folder.listdir(name=body['name'], is_folder=True), None):
            msg = gettext("A folder named “{name}” already exists.")
            return HttpResponseBadRequest(msg.format(name=body['name']), status=409)
        update_fields = []
        for field in self.get_fields(request, obj):
            if field in body and body[field] != getattr(obj, field):
                setattr(obj, field, body[field])
                update_fields.append(field)
        if update_fields:
            obj.save(update_fields=update_fields)
        return JsonResponse({
            'new_inode': self.serialize_inode(obj),
            'favorite_folders': self.get_favorite_folders(request, current_folder),
        })

    def copy_inodes(self, request, folder_id):
        if response := self.check_for_valid_post_request(request, folder_id):
            return response
        body = json.loads(request.body)
        current_folder = self.get_object(request, folder_id)
        inode_ids = body.get('inode_ids', [])
        for inode in FolderModel.objects.filter_inodes(id__in=inode_ids):
            inode.copy_to(current_folder, owner=request.user)
        return JsonResponse({
            'inodes': self.get_inodes(current_folder),
        })

    def move_inodes(self, request, folder_id):
        if response := self.check_for_valid_post_request(request, folder_id):
            return response
        body = json.loads(request.body)
        current_folder = self.get_object(request, folder_id)
        if 'target_folder' in body:
            if not (target_folder := self.get_object(request, body['target_folder'])):
                msg = gettext("Folder named “{folder}” not found.")
                return HttpResponseNotFound(msg.format(folder=body['target_folder']))
        else:
            target_folder = current_folder
        try:
            inode_ids = body.get('inode_ids', [])
            for inode in FolderModel.objects.filter_inodes(id__in=inode_ids):
                inode.parent = target_folder
                inode.validate_constraints()
                inode.save(update_fields=['parent'])
        except ValidationError as e:
            return HttpResponseBadRequest(e.message, status=409)
        return JsonResponse({
            'inodes': self.get_inodes(target_folder),
        })

    def delete_inodes(self, request, folder_id):
        if response := self.check_for_valid_post_request(request, folder_id):
            return response
        body = json.loads(request.body)
        current_folder = self.get_object(request, folder_id)
        trash_folder = FolderModel.objects.get_trash_folder(owner=request.user)
        if current_folder.id == trash_folder.id:
            return HttpResponseBadRequest("Cannot move inodes from trash folder into itself.")
        inode_ids = body.get('inode_ids', [])
        for inode in FolderModel.objects.filter_inodes(id__in=inode_ids):
            inode.parent = trash_folder
            inode.save(update_fields=['parent'])
            if inode.is_folder:
                PinnedFolder.objects.filter(folder=inode).delete()
        return JsonResponse({
            'favorite_folders': self.get_favorite_folders(request, current_folder),
        })

    def erase_trash_folder(self, request):
        if request.method != 'DELETE':
            return HttpResponseBadRequest(f"Method {request.method} not allowed. Only DELETE requests are allowed.")
        trash_folder = FolderModel.objects.get_trash_folder(owner=request.user)
        for inode in trash_folder.listdir():
            inode.delete()
        fallback_folder = self.get_fallback_folder(request)
        success_url = reverse('admin:finder_foldermodel_change', args=(fallback_folder.id,))
        return JsonResponse({'success_url': success_url})

    def toggle_pin(self, request, folder_id):
        if response := self.check_for_valid_post_request(request, folder_id):
            return response
        body = json.loads(request.body)
        current_folder = self.get_object(request, folder_id)
        if not (pinned_id := body.get('pinned_id')):
            return HttpResponseBadRequest("No pinned_id provided.")
        pinned_folder, created = PinnedFolder.objects.get_or_create(owner=request.user, folder_id=pinned_id)
        if created:
            request.session['finder_last_folder_id'] = None
        else:
            parent_folder = pinned_folder.folder.parent
            pinned_folder.delete()
            if str(folder_id) == pinned_id:
                return JsonResponse({
                    'success_url': reverse('admin:finder_foldermodel_change', args=(parent_folder.id,)),
                })
        return JsonResponse({
            'favorite_folders': self.get_favorite_folders(request, current_folder),
        })

    def add_folder(self, request, folder_id):
        if response := self.check_for_valid_post_request(request, folder_id):
            return response
        body = json.loads(request.body)
        if not (parent_folder := self.get_object(request, folder_id)):
            return HttpResponseNotFound(f"Folder {folder_id} not found.")
        if next(parent_folder.listdir(name=body['name'], is_folder=True), None):
            msg = gettext("A folder named “{name}” already exists.")
            return HttpResponseBadRequest(msg.format(name=body['name']), status=409)
        new_folder = FolderModel.objects.create(
            name=body['name'],
            parent=parent_folder,
            owner=request.user,
        )
        return JsonResponse({'new_folder': self.serialize_inode(new_folder)})

    def change_inode(self, request, folder_id):
        if response := self.check_for_valid_post_request(request, folder_id):
            return response
        body = json.loads(request.body)
        return JsonResponse({
            'new_data': {'foo': 'bar'},
        })
