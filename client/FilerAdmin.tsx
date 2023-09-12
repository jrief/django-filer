import React, {useRef, useState} from 'react';
import {
	DndContext,
	DragOverlay,
	PointerSensor,
	pointerWithin,
	useSensor,
	useSensors
} from '@dnd-kit/core';
import {restrictToWindowEdges} from '@dnd-kit/modifiers';
import {useClipboard, useLayout} from './Storage';
import {FileUploader} from './FileUploader';
import {FolderTabs} from './FolderTabs';
import {MenuBar} from './MenuBar';
import {SelectableArea} from './SelectableArea';
import {DraggedInodes} from './InodeList';
import {Droppable} from "./Droppable";
import DownloadIcon from './icons/download.svg';
import TrashIcon from './icons/trash.svg';


export default function FilerAdmin(props) {
	const {settings} = props;
	const primaryFolderId = settings.ancestors[0].folder;
	const uploaderRef = useRef(null);
	const overlayRef = useRef(null);
	const downloadLinkRef = useRef(null);
	const [clipboard, setClipboard] = useClipboard();
	const [ancestors, setAncestors] = useState(initializeAncestors());
	const [currentFolderId, setCurrentFolder] = useState(primaryFolderId);
	const [favoriteFolders, setFavoriteFolders] = useState(settings.favorite_folders);
	const [layout, setLayout] = useLayout('tiles');
	const [draggedIds, setDraggedIds] = useState(null);
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {distance: 4},
		}),
	);
	const dragModifiers = [modifyMovement, restrictToWindowEdges];
	const overlayStyle = {
		height: 'fit-content',
		width: 'fit-content',
	};

	function initializeAncestors() {
		return settings.ancestors.map(ancestor => ({
			folder: ancestor.folder,
			inodes: ancestor.inodes.map(inode => {
				const entry = clipboard.find(entry => entry.id === inode.id);
				return entry ? {...inode, cutted: entry.cutted, copied: entry.copied} : inode;
			}),
		}));
	}

	function clearClipboard() {
		setClipboard([]);
		// setAncestors(ancestors.map(ancestor => ({
		// 	folder: ancestor.folder,
		// 	inodes: ancestor.inodes.map(inode => ({...inode, cutted: false, copied: false})),
		// })));
	}

	function modifyMovement(args) {
		const {transform} = args;

		// If we are dragging multiple elements, we want to offset the drag overlay
		let offsetX = 0, offsetY = 0;
		if (overlayRef.current && draggedIds) {
			const firstDraggedInode = overlayRef.current.querySelector(`.inode-list [data-id="${draggedIds[0]}"]`);
			const lastDraggedInode = overlayRef.current.querySelector(`.inode-list [data-id="${draggedIds[1]}"]`);
			if (firstDraggedInode && lastDraggedInode) {
				offsetX = firstDraggedInode.getBoundingClientRect().left - lastDraggedInode.getBoundingClientRect().left;
				offsetY = firstDraggedInode.getBoundingClientRect().top - lastDraggedInode.getBoundingClientRect().top;
			}
		}

		return {
			...transform,
			x: transform.x + offsetX,
			y: transform.y + offsetY,
		};
	}

	function setInodes(folderId, inodes, modifier=inode => ({...inode, selected: false})) {
		if (folderId !== currentFolderId) {
			setCurrentFolder(folderId);
		}
		setAncestors(ancestors.map(ancestor => {
			return {
				folder: ancestor.folder,
				inodes: ancestor.folder === folderId
					? inodes
					: ancestor.inodes.map(inode => modifier(inode)),
			};
		}));
	}

	function deselectAll(event) {
		setAncestors(ancestors.map(ancestor => ({
			folder: ancestor.folder,
			inodes: ancestor.inodes.map(inode => ({...inode, selected: false})),
		})));
		setCurrentFolder(primaryFolderId);
	}

	async function addFolder() {
		const folderName = window.prompt("Enter folder name");
		if (!folderName)
			return;
		const response = await fetch(settings.add_folder_url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-CSRFToken': settings.csrf_token,
			},
			body: JSON.stringify({
				name: folderName,
			}),
		});
		const inodes = ancestors.find(ancestor => ancestor.folder === primaryFolderId).inodes;
		if (response.status === 200) {
			const data = await response.json();
			setInodes(primaryFolderId, [...inodes, data.new_folder]);
		} else {
			console.error(response);
		}
	}

	function copyInodes() {
		const inodes = getCurrentInodes();
		setClipboard(inodes.filter(inode => inode.selected).map(inode => ({...inode, selected: false, copied: true})));
		setInodes(currentFolderId, inodes.map(inode => ({...inode, selected: false, copied: inode.selected})));
	}

	function cutInodes() {
		const inodes = getCurrentInodes();
		setClipboard(inodes.filter(inode => inode.selected).map(inode => ({...inode, selected: false, cutted: true})));
		setInodes(currentFolderId, inodes.map(inode => ({...inode, selected: false, cutted: inode.selected})));
	}

	function pasteInodes() {
		let fetchUrl;
		let inodes = clipboard.filter(inode => inode.copied).map(inode => inode.id);
		if (inodes.length) {
			fetchUrl = settings.copy_inodes_url;
		} else {
			inodes = clipboard.filter(inode => inode.cutted).map(inode => inode.id);
			if (inodes.length) {
				fetchUrl = settings.move_inodes_url;
			}
		}
		clearClipboard();
		if (!fetchUrl)
			return;

		fetch(fetchUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-CSRFToken': settings.csrf_token,
			},
			body: JSON.stringify({inodes}),
		}).then(handleResponse);
	}

	function deleteInodes() {
		clearClipboard();
		const inodes = getCurrentInodes().filter(inode => inode.selected).map(inode => inode.id);
		fetch(settings.delete_inodes_url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-CSRFToken': settings.csrf_token,
			},
			body: JSON.stringify({inodes}),
		}).then(handleResponse);
	}

	async function eraseTrashFolder() {
		setClipboard([]);
		const response = await fetch(settings.erase_trash_folder_url, {
			method: 'DELETE',
			headers: {
				'X-CSRFToken': settings.csrf_token,
			},
		});
		if (response.status === 200) {
			const data = await response.json();
			window.location.assign(data.success_url);
		}
	}

	async function togglePin(pinnedId) {
		const response = await fetch(settings.toggle_pin_url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-CSRFToken': settings.csrf_token,
			},
			body: JSON.stringify({
				pinned_id: pinnedId
			}),
		});
		if (response.status === 200) {
			const data = await response.json();
			if (data.success_url) {
				// unpinned current folder, redirect to success_url
				window.location.assign(data.success_url);
				return;
			}
			setFavoriteFolders(data.favorite_folders);
		}
	}

	function switchLayout(newLayout: string) {
		setLayout(newLayout);
		if (newLayout !== layout && newLayout === 'columns') {
			fetch(settings.refresh_url).then(handleResponse);
		}
	}

	function downloadFiles(draggedInodes) {
		draggedInodes.forEach(inode => {
			downloadLinkRef.current.href = inode.url;
			downloadLinkRef.current.download = inode.name;
			downloadLinkRef.current.click();
		});
	}

	function handleResponse(response: Response) {
		if (response.status === 200) {
			response.json().then(data => {
				setAncestors(data.ancestors);
				setFavoriteFolders(data.favorite_folders);
			});
		} else {
			console.error(response);
		}
	}

	function handleDragStart(event) {
		const {active} = event;
		const folderId = active.data.current.folderId;
		console.log("drag start");
		console.log(event);
		const inodes = ancestors.find(ancestor => ancestor.folder === folderId).inodes;
		const multiSelected = inodes.some(inode => inode.selected && inode.id === active.id);
		const draggedInodes= multiSelected
			? inodes.map(inode => ({...inode, dragged: inode.selected}))
			: inodes.map(inode => ({...inode, dragged: inode.id === active.id, selected: false}));
		const firstDraggedIndex = draggedInodes.findIndex(inode => inode.dragged);
		setDraggedIds(firstDraggedIndex !== -1 ? [draggedInodes[firstDraggedIndex].id, active.id] : null);
		setInodes(folderId, draggedInodes);
		console.log(draggedInodes.filter(inode => inode.dragged));
	}

	function handleDragEnd(event) {
		const {active, over} = event;
		const folderId = active.data.current.folderId;
		setDraggedIds(null);
		const inodes = ancestors.find(ancestor => ancestor.folder === folderId).inodes;
		setInodes(folderId, inodes.map(inode => ({...inode, dragged: false})));
		if (over) {
			const [what, targetFolder] = over.id.split(':');
			const draggedInodes = inodes.filter(inode => inode.dragged);
			if (what === 'column' && draggedInodes.every(inode => inode.parent === targetFolder))
				return;
			overlayRef.current.hidden = true;
			if (what === 'download') {
				downloadFiles(draggedInodes);
				setTimeout(() => {
					overlayRef.current.hidden = false;
				}, 1000);
				return;
			}
			const fetchUrl = what === 'discard' ? settings.delete_inodes_url : settings.move_inodes_url;
			fetch(fetchUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-CSRFToken': settings.csrf_token,
				},
				body: JSON.stringify({
					inodes: draggedInodes.map(inode => inode.id),
					target_folder: targetFolder,
				}),
			}).then(handleResponse).finally(() => {
				overlayRef.current.hidden = false;
			});
		}
	}

	function handleDragCancel() {
		setAncestors(ancestors.map(ancestor => ({
			folder: ancestor.folder,
			inodes: ancestor.inodes.map(inode => ({...inode, dragged: false})),
		})));
	}

	function getCurrentInodes() {
		return ancestors.find(ancestor => ancestor.folder === currentFolderId).inodes;
	}

	function getNumSelected() {
		return getCurrentInodes().filter(inode => inode.selected).length;
	}

	const kwargs = {deselectAll, handleResponse, setInodes, currentFolderId, settings, clearClipboard};

	function renderWorkArea() {
		if (settings.is_trash) return (
			<div className="work-area tiles">
				<SelectableArea {...kwargs} folderId={ancestors[0].folder} inodes={ancestors[0].inodes} layout="tiles" />
			</div>
		);

		if (layout !== 'columns') return (
			<div className={`work-area ${layout}`}>
				<FileUploader ref={uploaderRef} folderId={primaryFolderId} settings={settings} handleResponse={handleResponse}>
					<SelectableArea {...kwargs} folderId={primaryFolderId} inodes={ancestors[0].inodes} layout={layout} />
				</FileUploader>
			</div>
		);

		let previousFolder = null;
		return (
			<div className={`work-area ${layout}`}>{
				ancestors.map(ancestor => {
					const snippet = (
					<FileUploader
						key={ancestor.folder}
						ref={ancestor.folder === primaryFolderId ? uploaderRef : null}
						folderId={ancestor.folder}
						settings={settings}
						handleResponse={handleResponse}
					>
						<SelectableArea {...kwargs} folderId={ancestor.folder} inodes={ancestor.inodes} layout={layout} previousFolder={previousFolder} />
					</FileUploader>
					);
					previousFolder = ancestor.folder;
					return snippet;
				})
			}</div>
		);
	}

	function renderDroppables() {
		return (<>
			<Droppable id="download:droppable" className="download-droppable" dragging={Boolean(draggedIds)}>
				<DownloadIcon />
			</Droppable>
			<a ref={downloadLinkRef} download="download" hidden />
			<Droppable id="discard:droppable" className="discard-droppable" dragging={Boolean(draggedIds)}>
				<TrashIcon />
			</Droppable>
		</>);
	}

	return (<>
		<MenuBar
			clipboard={clipboard}
			parentUrl={settings.parent_url}
			addFolder={addFolder}
			openUploader={() => uploaderRef.current.openUploader()}
			setLayout={switchLayout}
			copyInodes={copyInodes}
			cutInodes={cutInodes}
			pasteInodes={pasteInodes}
			deleteInodes={deleteInodes}
			eraseTrashFolder={eraseTrashFolder}
			isRoot={settings.is_root}
			isTrash={settings.is_trash}
			numSelected={getNumSelected()}
		/>
		<DndContext
			onDragStart={handleDragStart}
			onDragEnd={handleDragEnd}
			onDragCancel={handleDragCancel}
			sensors={sensors}
			collisionDetection={pointerWithin}
		>
			<FolderTabs activeFolderId={settings.id} folders={favoriteFolders} togglePin={togglePin} />
			{renderWorkArea()}
			{settings.is_trash ? null : renderDroppables()}
			<div ref={overlayRef}>
				<DragOverlay className={`drag-overlay ${layout}`} style={overlayStyle} modifiers={dragModifiers}>
					<DraggedInodes inodes={getCurrentInodes()} layout={layout} />
				</DragOverlay>
			</div>
		</DndContext>
	</>);
}
