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
import {InodeList} from './InodeList';


export default function FilerAdmin(props) {
	const {settings} = props;
	const uploaderRef = useRef(null);
	const overlayRef = useRef(null);
	const [ancestors, setAncestors] = useState(settings.ancestors);
	const [favoriteFolders, setFavoriteFolders] = useState(settings.favorite_folders);
	const [currentDepth, setCurrentDepth] = useState(0);
	const [layout, setLayout] = useLayout('tiles');
	const [clipboard, setClipboard] = useClipboard();
	const [draggedIds, setDraggedIds] = useState(null);
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {distance: 4},
		}),
	);
	const modifiers = [modifyMovement, restrictToWindowEdges];
	const overlayStyle = {
		height: 'fit-content',
		width: 'fit-content',
	};

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

	function setInodes(depth, inodes) {
		setAncestors(ancestors.map((ancestor, index) => {
			if (index === depth)
				return inodes;
			return ancestor.map(inode => ({...inode, selected: false, cutted: false, copied: false}));
		}));
	}

	function refreshFolder() {
		debugger;
		console.log('refreshFolder');
		fetch(settings.fetch_inodes_url).then(handleResponse);
	}

	function deselectAll(event) {
		setAncestors(ancestors.map(ancestor => ancestor.map(inode => ({...inode, selected: false}))));
	}

	async function addFolder() {
		const folderName = window.prompt("Enter folder name");
		const inodes = ancestors[currentDepth];
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
		if (response.status === 200) {
			const data = await response.json();
			setInodes(currentDepth, [...inodes, data.new_folder]);
		} else {
			console.error(response);
		}
	}

	function copyInodes() {
		const inodes = ancestors[currentDepth];
		setClipboard(inodes.filter(inode => inode.selected).map(inode => ({...inode, selected: false, copied: true})));
		setInodes(currentDepth, inodes.map(inode => ({...inode, copied: inode.selected, selected: false})));
	}

	function cutInodes() {
		const inodes = ancestors[currentDepth];
		setClipboard(inodes.filter(inode => inode.selected).map(inode => ({...inode, selected: false, cutted: true})));
		setInodes(currentDepth, inodes.map(inode => ({...inode, cutted: inode.selected, selected: false})));
	}

	async function pasteInodes() {
		let fetchUrl;
		let pastedInodes = clipboard.filter(inode => inode.copied).map(inode => inode.id);
		if (pastedInodes.length) {
			fetchUrl = settings.copy_inodes_url;
		} else {
			pastedInodes = clipboard.filter(inode => inode.cutted).map(inode => inode.id);
			if (pastedInodes.length) {
				fetchUrl = settings.move_inodes_url;
			}
		}
		if (!fetchUrl)
			return;

		const response = await fetch(fetchUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-CSRFToken': settings.csrf_token,
			},
			body: JSON.stringify({
				inodes: pastedInodes
			}),
		});
		if (response.status === 200) {
			const data = await response.json();
			setInodes(currentDepth, data.inodes);
			setFavoriteFolders(data.favorite_folders);
			setClipboard([]);
		}
	}

	function deleteInodes() {
		setClipboard([]);
		const inodes = ancestors[currentDepth];
		const selectedInodes = inodes.filter(inode => inode.selected).map(inode => inode.id);
		fetch(settings.delete_inodes_url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-CSRFToken': settings.csrf_token,
			},
			body: JSON.stringify({
				inodes: selectedInodes
			}),
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
			window.location.reload();
		}
	}

	function downloadFiles(draggedInodes) {
		draggedInodes.forEach(inode => {
			// downloadLinkRef.current.href = inode.url;
			// downloadLinkRef.current.download = inode.name;
			// downloadLinkRef.current.click();
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
		console.log("drag start");
		const inodes = ancestors[currentDepth];
		const multiSelected = inodes.some(inode => inode.selected && inode.id === active.id);
		const draggedInodes= multiSelected
			? inodes.map(inode => ({...inode, dragged: inode.selected}))
			: inodes.map(inode => ({...inode, dragged: inode.id === active.id, selected: false}));
		const firstDraggedIndex = draggedInodes.findIndex(inode => inode.dragged);
		setDraggedIds(firstDraggedIndex !== -1 ? [draggedInodes[firstDraggedIndex].id, active.id] : null);
		setInodes(currentDepth, draggedInodes);
		console.log(draggedInodes.filter(inode => inode.dragged));
	}

	async function handleDragEnd(event) {
		const {active, over} = event;
		setDraggedIds(null);
		const inodes = ancestors[currentDepth];
		setInodes(currentDepth, inodes.map(inode => ({...inode, dragged: false})));
		if (over && active.id !== over.id) {
			overlayRef.current.hidden = true;
			const draggedInodes = inodes.filter(inode => inode.dragged);
			if (over.id === 'download-droppable')
				return downloadFiles(draggedInodes);
			const fetchUrl = over.id === 'recycle-droppable' ? settings.delete_inodes_url : settings.move_inodes_url;
			fetch(fetchUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-CSRFToken': settings.csrf_token,
				},
				body: JSON.stringify({
					inodes: draggedInodes.map(inode => inode.id),
					target_folder: over.id,
				}),
			}).then(handleResponse).finally(() => {
				overlayRef.current.hidden = false;
			});
		}
	}

	function handleDragCancel() {
		const inodes = ancestors[currentDepth];
		setInodes(currentDepth, inodes.map(inode => ({...inode, dragged: false})));
	}

	const kwargs = {deselectAll, handleResponse, setInodes, setCurrentDepth, settings};
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
			numSelected={ancestors[currentDepth].filter(inode => inode.selected).length}
		/>
		<DndContext
			onDragStart={handleDragStart}
			onDragEnd={handleDragEnd}
			onDragCancel={handleDragCancel}
			sensors={sensors}
			collisionDetection={pointerWithin}
		>
			<FolderTabs activeFolderId={settings.id} folders={favoriteFolders} togglePin={togglePin} />
			{settings.is_trash ? (
			<div className="work-area tiles">
				<SelectableArea {...kwargs} inodes={ancestors[0]} layout="tiles" />
			</div>
			) : (
			<div className={`work-area ${layout}`}>
			{layout === 'columns' ? ancestors.map((inodes, depth) => (
				<FileUploader ref={uploaderRef} key={depth} settings={settings} refreshFolder={refreshFolder}>
					<SelectableArea {...kwargs} depth={depth} inodes={inodes} layout={layout} />
				</FileUploader>
				)) : (
				<FileUploader ref={uploaderRef} settings={settings} refreshFolder={refreshFolder}>
					<SelectableArea {...kwargs} depth={0} inodes={ancestors[0]} layout={layout} />
				</FileUploader>
			)}
			</div>
			)}
			{/*{settings.is_trash ? null : (<>*/}
			{/*<AlternativeDroppable id="download-droppable" className="download-droppable">*/}
			{/*	<DownloadIcon />*/}
			{/*</AlternativeDroppable>*/}
			{/*<a ref={downloadLinkRef} download="download" hidden />*/}
			{/*<AlternativeDroppable id="recycle-droppable" className="recycle-droppable">*/}
			{/*	<TrashIcon />*/}
			{/*</AlternativeDroppable>*/}
			{/*</>)}*/}
			<div ref={overlayRef}>
				<DragOverlay className={`drag-overlay ${layout}`} style={overlayStyle} modifiers={modifiers}>
					<InodeList inodes={ancestors[currentDepth]} layout={layout} dragOverlay={true} />
				</DragOverlay>
			</div>
		</DndContext>
	</>);
}
