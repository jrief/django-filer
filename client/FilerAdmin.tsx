import React, {useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
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
import {FolderSettings} from './FolderSettings';
import {FileUploader} from './FileUploader';
import {FolderTabs} from './FolderTabs';
import {MenuBar} from './MenuBar';
import {SelectableArea} from './SelectableArea';
import {DraggedInodes} from './InodeList';
import {Droppable} from "./Droppable";
import DownloadIcon from './icons/download.svg';
import TrashIcon from './icons/trash.svg';


function useSearchParam(key) : [string, (value: string) => any] {
	const params = new URLSearchParams(window.location.search);
	const [value, setValue] = useState(
		params.get(key) || ''
	);

	function setParam(value) {
		console.log('setParam', value);
		if (value) {
			const params = new URLSearchParams();
			params.set(key, value);
			const url = `${window.location.pathname}?${params.toString()}`;
			window.history.pushState(Object.fromEntries(params.entries()), undefined, url);
		} else {
			window.history.pushState({}, undefined, window.location.pathname);
		}
	}

	return [
		value,
		value => {
			setParam(value);
			setValue(value);
		},
	];
}


export default function FilerAdmin(props) {
	const settings = useContext(FolderSettings); console.log(settings);
	const uploaderRef = useRef(null);
	const areaRefs = Object.fromEntries(settings.ancestors.map(id => [id, useRef(null)]));
	const overlayRef = useRef(null);
	const downloadLinkRef = useRef(null);
	const [clipboard, setClipboard] = useClipboard();
	const [currentFolderId, setCurrentFolder] = useState(settings.folder_id);
	const [favoriteFolders, setFavoriteFolders] = useState(settings.favorite_folders);
	const [layout, setLayout] = useLayout('tiles');
	const [searchQuery, setSearchQuery] = useSearchParam('q');
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
	window.addEventListener('keydown', event => {
		if (event.key === 'Escape') {
			deselectAll(event);
		} else if (event.key === 'c' && (event.ctrlKey || event.metaKey || event.altKey)) {
			copyInodes();
		} else if (event.key === 'x' && (event.ctrlKey || event.metaKey || event.altKey)) {
			cutInodes();
		} else if (event.key === 'v' && (event.ctrlKey || event.metaKey || event.altKey)) {
			pasteInodes();
		} else if (['Backspace', 'Delete'].includes(event.key)) {
			deleteInodes();
		}
	});
	// useEffect(() => {
	// 	console.log('useEffect', searchQuery);
	// 	fetchInodes();
	// }, [searchQuery]);
	//initializeAncestors();
	// useCallback(() => {
	// 	console.log('useCallback', searchQuery);
	// 	initializeAncestors();
	// }, [searchQuery]);

	// useEffect(() => {
	// 	initializeAncestors();
	// }, []);

	// function getPrimaryFolderId() {
	// 	const found = window.location.pathname.match(/^.+\/([0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12})\/.+$/);
	// 	if (!found)
	// 		throw new Error(`Invalid URL for django-filer: ${window.location.pathname}`);
	// 	return found[1];
	// }

	// async function initializeAncestors() {
	// 	const ancestors = [];
	// 	let fetch_inodes_url = settings.fetch_inodes_url;
	// 	console.log('fetch_inodes_url', fetch_inodes_url);
	// 	while (fetch_inodes_url) {
	// 		const response = await fetch(fetch_inodes_url);
	// 		if (response.ok) {
	// 			const body = await response.json();
	// 			ancestors.push({
	// 				folder: body.folder,
	// 				inodes: body.inodes,
	// 			});
	// 			fetch_inodes_url = body.fetch_parent_url;
	// 		} else {
	// 			console.error(response);
	// 			return;
	// 		}
	// 	}
	// 	setAncestors(ancestors);
	//
	// 	ancestors.map(ancestor => ({
	// 		folder: ancestor.folder,
	// 		inodes: ancestor.inodes.map(inode => {
	// 			const entry = clipboard.find(entry => entry.id === inode.id);
	// 			return entry ? {...inode, cutted: entry.cutted, copied: entry.copied} : inode;
	// 		}),
	// 	}));
	// }

	// function initializeCurrentFolder() {
	//  	const params = new URLSearchParams(window.location.search);
	// 	return params.get('q') ? 'search-result' : primaryFolderId;
	// }

	function clearClipboard() {
		setClipboard([]);
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

	// function setInodes(folderId, inodes, modifier=inode => ({...inode, selected: false})) {
	// 	if (folderId !== currentFolderId) {
	// 		setCurrentFolder(folderId);
	// 	}
	// 	setAncestors(ancestors.map(ancestor => {
	// 		return {
	// 			folder: ancestor.folder,
	// 			inodes: ancestor.folder === folderId
	// 				? inodes
	// 				: ancestor.inodes.map(inode => modifier(inode)),
	// 		};
	// 	}));
	// }

	function deselectAll(event?) {
		setAncestors(ancestors.map(ancestor => ({
			folder: ancestor.folder,
			inodes: ancestor.inodes.map(inode => ({...inode, selected: false})),
		})));
		setCurrentFolder(primaryFolderId);
	}

	function searchForInodes(query: string) {
		const params = new URLSearchParams({q: query});
		const searchUrl = `${settings.search_inodes_url}?${params.toString()}`;
		fetch(searchUrl).then(async response => {
			if (response.ok) {
				const body = await response.json();
				setCurrentFolder('search-result');
				setAncestors([{
					folder: 'search-result',
					inodes: body.inodes,
				}]);
			} else {
				console.error(response);
			}
		});
	}

	// function addFolder() {
	// 	const folderName = window.prompt("Enter folder name");
	// 	if (!folderName)
	// 		return;
	// 	const addFolderUrl = `${settings.base_url}${settings.folder_id}/add_folder`;
	// 	fetch(addFolderUrl, {
	// 		method: 'POST',
	// 		headers: {
	// 			'Content-Type': 'application/json',
	// 			'X-CSRFToken': settings.csrf_token,
	// 		},
	// 		body: JSON.stringify({
	// 			name: folderName,
	// 		}),
	// 	}).then(async response => {
	// 		const inodes = getCurrentInodes();
	// 		if (response.status === 200) {
	// 			const body = await response.json();
	// 			setInodes(primaryFolderId, [...inodes, body.new_folder]);
	// 		} else {
	// 			console.error(response);
	// 		}
	// 	});
	// }

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

		if (searchQuery) {
			const params = new URLSearchParams({q: searchQuery});
			fetchUrl = `${fetchUrl}?${params.toString()}`;
		}
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
		let fetchUrl = settings.delete_inodes_url;
		if (searchQuery) {
			const params = new URLSearchParams({q: searchQuery});
			fetchUrl = `${fetchUrl}?${params.toString()}`;
		}
		fetch(fetchUrl, {
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

	// async function togglePin(pinnedId) {
	// 	const response = await fetch(settings.toggle_pin_url, {
	// 		method: 'POST',
	// 		headers: {
	// 			'Content-Type': 'application/json',
	// 			'X-CSRFToken': settings.csrf_token,
	// 		},
	// 		body: JSON.stringify({
	// 			pinned_id: pinnedId
	// 		}),
	// 	});
	// 	if (response.status === 200) {
	// 		const data = await response.json();
	// 		if (data.success_url) {
	// 			// unpinned current folder, redirect to success_url
	// 			window.location.assign(data.success_url);
	// 			return;
	// 		}
	// 		setFavoriteFolders(data.favorite_folders);
	// 	}
	// }

	function fetchInodes() {
		let fetchUrl = settings.refresh_url;
		if (searchQuery) {
			const params = new URLSearchParams({q: searchQuery});
			fetchUrl = `${fetchUrl}?${params.toString()}`;
		}
		fetch(fetchUrl).then(handleResponse);
	}

	function switchLayout(newLayout: string) {
		setLayout(newLayout);
		if (newLayout !== layout && newLayout === 'columns') {
			fetchInodes();
		}
	}

	function downloadFiles(inodes) {
		inodes.forEach(inode => {
			downloadLinkRef.current.href = inode.download_url;
			downloadLinkRef.current.download = inode.name;
			downloadLinkRef.current.click();
		});
	}

	function downloadSelected() {
		downloadFiles(getCurrentInodes().filter(inode => !inode.is_folder && inode.selected));
		clearClipboard();
		deselectAll();
	}

	function handleDragStart(event) {
		const {active} = event;
		const folderId = active.data.current.folderId;
		const inodes = ancestors.find(ancestor => ancestor.folder === folderId).inodes;
		const multiSelected = inodes.some(inode => inode.selected && inode.id === active.id);
		const draggedInodes= multiSelected
			? inodes.map(inode => ({...inode, dragged: inode.selected}))
			: inodes.map(inode => ({...inode, dragged: inode.id === active.id, selected: false}));
		const firstDraggedIndex = draggedInodes.findIndex(inode => inode.dragged);
		setDraggedIds(firstDraggedIndex !== -1 ? [draggedInodes[firstDraggedIndex].id, active.id] : null);
		setInodes(folderId, draggedInodes);
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
					clearClipboard();
				}, 1000);
				return;
			}
			let fetchUrl = what === 'discard' ? settings.delete_inodes_url : settings.move_inodes_url;
			if (searchQuery) {
				const params = new URLSearchParams({q: searchQuery});
				fetchUrl = `${fetchUrl}?${params.toString()}`;
			}
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
		return [];
		return ancestors.find(ancestor => ancestor.folder === currentFolderId)?.inodes ?? [];
	}

	function getNumSelected() {
		return getCurrentInodes().filter(inode => inode.selected).length;
	}

	function getNumSelectedFiles() {
		return getCurrentInodes().filter(inode => !inode.is_folder && inode.selected).length;
	}

	function renderWorkArea() {
		const attributes = {deselectAll, clearClipboard, layout};

		if (settings.is_trash) return (
			<div className={`work-area ${layout}`}>
				<SelectableArea {...attributes} folderId={settings.folder} />
			</div>
		);

		if (searchQuery) return (
			<div className={`work-area ${layout}`}>
				<SelectableArea {...attributes} folderId="search-result" inodes={ancestors.find(ancestor => ancestor.folder === 'search-result').inodes} />
			</div>
		);

		let previousFolder = null;
		return (
			<div className={`work-area ${layout}`}>{
				(layout === 'columns' ? settings.ancestors : [settings.ancestors[0]]).map(folderId => {
					const snippet = (
					<FileUploader
						key={folderId}
						ref={folderId === settings.folder_id ? uploaderRef : null}
						folderId={folderId}
						handleUpload={id => areaRefs[id].current.fetchInodes()}
					>
						<SelectableArea ref={areaRefs[folderId]} {...attributes} folderId={folderId} previousFolder={previousFolder} />
					</FileUploader>
					);
					previousFolder = folderId;
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

	console.log("render main");
	return (<>
		<MenuBar
			clipboard={clipboard}
			addFolder={() => areaRefs[settings.folder_id].current.addFolder()}
			openUploader={() => uploaderRef.current.openUploader()}
			downloadSelected={downloadSelected}
			setSearchQuery={setSearchQuery}
			setLayout={switchLayout}
			copyInodes={copyInodes}
			cutInodes={cutInodes}
			pasteInodes={pasteInodes}
			deleteInodes={deleteInodes}
			eraseTrashFolder={eraseTrashFolder}
			numSelected={getNumSelected()}
			numSelectedFiles={getNumSelectedFiles()}
		/>
		<DndContext
			onDragStart={handleDragStart}
			onDragEnd={handleDragEnd}
			onDragCancel={handleDragCancel}
			sensors={sensors}
			collisionDetection={pointerWithin}
		>
			<FolderTabs
				activeFolderId={currentFolderId === 'search-result' ? 'search-result' : settings.folder_id}
				favoriteFolders={favoriteFolders}
				setFavoriteFolders={setFavoriteFolders}
			/>
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
