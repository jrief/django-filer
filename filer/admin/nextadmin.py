import json
import uuid

from django.contrib import admin
from django.contrib.admin.utils import unquote
from django.core.exceptions import ValidationError
from django.db.models.expressions import F, Value
from django.db.models.fields import BooleanField, CharField
from django.db.models.functions import Concat

from django.forms.widgets import Media
from django.http.response import (
    HttpResponse, HttpResponseBadRequest, HttpResponseNotFound, HttpResponseRedirect, JsonResponse
)
from django.middleware.csrf import get_token
from django.template.response import TemplateResponse
from django.urls import path, reverse
from django.utils.translation import gettext_lazy as _

from filer.models.nextmodels import InodeModel, NextFolder, NextFile, PinnedFolder


class InodeAdmin(admin.ModelAdmin):
    extra_data_fields = ['owner_name', 'is_folder', 'parent']

    def get_fallback_folder(self, request):
        try:
            last_folder_id = request.session['filer_last_folder_id']
            return NextFolder.objects.get(id=last_folder_id)
        except (NextFolder.DoesNotExist, KeyError, ValidationError):
            return NextFolder.objects.root_folder

    def get_favorite_folders(self, request, current_folder):
        def serialize(obj, **kwargs):
            data = dict(
                id=obj.serializable_value('id'),
                name=obj.serializable_value('name'),
                url=reverse('admin:filer_nextfolder_change', args=(obj.id,)),
                is_root=obj.is_root,
                **kwargs,
            )
            return data

        url = reverse('admin:filer_nextfolder_change', args=(':',))
        index = url.find(':')
        folders = []
        folders.extend(
            PinnedFolder.objects.filter(owner=request.user)
                .select_related('folder')
                .values('folder__id', 'folder__name')
                .annotate(id=F('folder__id'))
                .annotate(name=F('folder__name'))
                .values('id', 'name')
                .annotate(url=Concat(Value(url[:index]), 'id', Value(url[index + 1:]), output_field=CharField()))
                .annotate(is_pinned=Value(True, output_field=BooleanField()))
        )
        fallback_folder = self.get_fallback_folder(request)
        root_folder = NextFolder.objects.root_folder
        trash_folder = NextFolder.objects.get_trash_folder(owner=request.user)
        for f in folders:
            if f['id'] == current_folder.id:
                if fallback_folder.id != root_folder.id or len(folders) == 0:
                    folders.insert(0, serialize(fallback_folder))
                break
        else:
            if current_folder.id == trash_folder.id:
                if fallback_folder.id != root_folder.id or len(folders) == 0:
                    folders.insert(0, serialize(fallback_folder))
            else:
                folders.insert(0, serialize(current_folder))
        if trash_folder.num_children > 0:
            folders.append(serialize(trash_folder, is_trash=True))
        return folders

    def get_inodes(self, folder):
        """
        Return a serialized list of file/folder-s for the given folder.
        """
        inodes = []
        for inode_model in InodeModel.all_models:
            queryset = inode_model.objects.select_related('owner') \
                .filter(parent=folder) \
                .annotate(owner_name=F('owner__username')) \
                .annotate(is_folder=Value(inode_model.is_folder, output_field=BooleanField()))
            data_fields = inode_model.data_fields + self.extra_data_fields
            inodes.extend(values | computed for values, computed in zip(
                queryset.values(*data_fields),
                ({
                    'url': reverse('admin:filer_nextfolder_change', args=(obj.id,)),
                    'thumbnail_url': obj.get_thumbnail_url(),
                    'summary': obj.summary,
                } for obj in queryset))
            )
        return inodes

    def get_ancestors(self, request, folder):
        ancestors = []
        while folder:
            ancestors.append({
                'folder': folder.id,
                'inodes': self.get_inodes(folder),
            })
            if request.COOKIES.get('django-filer-layout') != 'columns':
                break  # not required for layout in ['tiles', 'list']
            folder = folder.parent
        return ancestors

    def get_breadcrumbs(self, request, folder):
        breadcrumbs = []
        while folder:
            breadcrumbs.append({
                'link': reverse('admin:filer_nextfolder_change', args=(folder.id,)),
                'name': folder.name,
            })
            folder = folder.parent
        breadcrumbs.reverse()
        return breadcrumbs


@admin.register(NextFolder)
class FolderAdmin(InodeAdmin):
    folder_template = 'admin/filer/next/folder.html'
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
                self.admin_site.admin_view(self.fetch_ancestors),
                name='filer_fetch_ancestors',
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
        url = reverse('admin:filer_nextfolder_change', args=(fallback_folder.id,))
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
        trash_folder = NextFolder.objects.get_trash_folder(owner=request.user)
        favorite_folders = self.get_favorite_folders(request, obj)
        context.update(
            breadcrumbs=self.get_breadcrumbs(request, obj),
            folder_settings=dict(
                id=obj.id,
                name=obj.name,
                ancestors=self.get_ancestors(request, obj),
                move_inodes_url=reverse('admin:filer_move_inodes', args=(obj.id,)),
                refresh_url=reverse('admin:filer_fetch_ancestors', args=(obj.id,)),
                toggle_pin_url=reverse('admin:filer_toggle_pin', args=(obj.id,)),
                favorite_folders=favorite_folders,
                legends=self._legends,
                csrf_token=get_token(request),
            )
        )
        if trash_folder.id != obj.id:
            upload_files_uuid = uuid.UUID(32 * '0')
            context['folder_settings'].update(
                is_root=obj.is_root,
                is_trash=False,
                upload_files_url=reverse('admin:filer_upload_files', args=(upload_files_uuid,)),
                update_inode_url=reverse('admin:filer_update_inode', args=(obj.id,)),
                copy_inodes_url=reverse('admin:filer_copy_inodes', args=(obj.id,)),
                delete_inodes_url=reverse('admin:filer_delete_inodes', args=(obj.id,)),
                add_folder_url=reverse('admin:filer_add_folder', args=(obj.id,)),
                parent_url=reverse('admin:filer_nextfolder_change', args=(obj.parent_id,)) if obj.parent_id else None,
            )
            if not obj.is_root and not next(filter(lambda f: f['id'] == obj.id and f.get('is_pinned'), favorite_folders), None):
                request.session['filer_last_folder_id'] = str(obj.id)
        else:
            context['folder_settings'].update(
                is_root=False,
                is_trash=True,
                erase_trash_folder_url=reverse('admin:filer_erase_trash_folder'),
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

    def fetch_ancestors(self, request, folder_id):
        if not (current_folder := self.get_object(request, folder_id)):
            return HttpResponseNotFound(f"Folder {folder_id} not found.")
        return JsonResponse({
            'ancestors': self.get_ancestors(request, current_folder),
            'favorite_folders': self.get_favorite_folders(request, current_folder),
        })

    def upload_files(self, request, folder_id):
        if request.method != 'POST':
            return HttpResponseBadRequest('Only POST requests are allowed.')
        if not (folder := self.get_object(request, folder_id)):
            return HttpResponseNotFound(f"Folder {folder_id} not found.")
        if request.content_type == 'multipart/form-data' and 'upload_file' in request.FILES:
            model = NextFile.objects.get_model_for(request.FILES['upload_file'].content_type)
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
        current_folder = self.get_object(request, folder_id)
        try:
            obj = self.get_object(request, body['id'])
        except (InodeModel.DoesNotExist, KeyError):
            return HttpResponseNotFound(f"Inode(id={body.get('id', '<missing>')}) not found.")
        update_fields = []
        for field in self.get_fields(request, obj):
            if field in body and body[field] != getattr(obj, field):
                setattr(obj, field, body[field])
                update_fields.append(field)
        if update_fields:
            obj.save(update_fields=update_fields)
        new_inode = {
            'owner_name': obj.owner.username,
            'is_folder': obj.is_folder,
            'parent': obj.parent_id,
            'url': reverse('admin:filer_nextfolder_change', args=(obj.id,)),
            'thumbnail_url': obj.get_thumbnail_url(),
        }
        for field in obj.data_fields:
            new_inode[field] = getattr(obj, field)
        return JsonResponse({'new_inode': new_inode})

    def copy_inodes(self, request, folder_id):
        if response := self.check_for_valid_post_request(request, folder_id):
            return response
        body = json.loads(request.body)
        source_folder = self.get_object(request, folder_id)
        for inode in NextFolder.objects.filter_inodes({'id__in': body['inodes']}):
            inode.copy_to(source_folder, owner=request.user)
        return JsonResponse({
            'ancestors': self.get_ancestors(request, source_folder),
            'favorite_folders': self.get_favorite_folders(request, source_folder),
        })

    def move_inodes(self, request, folder_id):
        if response := self.check_for_valid_post_request(request, folder_id):
            return response
        body = json.loads(request.body)
        current_folder = self.get_object(request, folder_id)
        if 'target_folder' in body:
            if not (target_folder := self.get_object(request, body['target_folder'])):
                return HttpResponseNotFound(f"Folder {body['target_folder']} not found.")
        else:
            target_folder = current_folder
        for inode in NextFolder.objects.filter_inodes({'id__in': body.get('inodes')}):
            inode.parent = target_folder
            inode.save(update_fields=['parent'])
        return JsonResponse({
            'ancestors': self.get_ancestors(request, current_folder),
            'favorite_folders': self.get_favorite_folders(request, current_folder),
        })

    def delete_inodes(self, request, folder_id):
        if response := self.check_for_valid_post_request(request, folder_id):
            return response
        body = json.loads(request.body)
        current_folder = self.get_object(request, folder_id)
        trash_folder = NextFolder.objects.get_trash_folder(owner=request.user)
        if current_folder.id == trash_folder.id:
            return HttpResponseBadRequest("Cannot move inodes from trash folder into itself.")
        inodes = body.get('inodes', [])
        for inode in NextFolder.objects.filter_inodes({'id__in': inodes}):
            inode.parent = trash_folder
            inode.save(update_fields=['parent'])
        return JsonResponse({
            'ancestors': self.get_ancestors(request, current_folder),
            'favorite_folders': self.get_favorite_folders(request, current_folder),
        })

    def erase_trash_folder(self, request):
        if request.method != 'DELETE':
            return HttpResponseBadRequest(f"Method {request.method} not allowed. Only DELETE requests are allowed.")
        trash_folder = NextFolder.objects.get_trash_folder(owner=request.user)
        for child in trash_folder.get_children():
            child.delete()
        fallback_folder = self.get_fallback_folder(request)
        success_url = reverse('admin:filer_nextfolder_change', args=(fallback_folder.id,))
        return JsonResponse({'success_url': success_url})

    def toggle_pin(self, request, folder_id):
        if response := self.check_for_valid_post_request(request, folder_id):
            return response
        body = json.loads(request.body)
        current_folder = self.get_object(request, folder_id)
        if not (pinned_id := body.get('pinned_id')):
            return HttpResponseBadRequest("No pinned_id provided.")
        root_folder = NextFolder.objects.root_folder
        pinned_folder, created = PinnedFolder.objects.get_or_create(owner=request.user, folder_id=pinned_id)
        if created:
            request.session['filer_last_folder_id'] = None
        else:
            pinned_folder.delete()
            if str(folder_id) == pinned_id:
                # removed the current folder from the pinned folders
                favorite_folders = self.get_favorite_folders(request, current_folder)
                if len(favorite_folders) > 0:
                    success_url = favorite_folders[0]['url']
                else:
                    success_url = reverse('admin:filer_nextfolder_change', args=(root_folder.id,))
                return JsonResponse({
                    'success_url': success_url,
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

    def change_inode(self, request, folder_id):
        if response := self.check_for_valid_post_request(request, folder_id):
            return response
        body = json.loads(request.body)
        return JsonResponse({
            'new_data': {'foo': 'bar'},
        })


@admin.register(NextFile)
class FileAdmin(InodeAdmin):
    fields = ['name', 'file_name']

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
