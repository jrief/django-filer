import React, {useContext, useRef, useState} from 'react';
import {
	DndContext,
	DragOverlay,
	PointerSensor,
	pointerWithin,
	useSensor,
	useSensors
} from '@dnd-kit/core';
import {restrictToWindowEdges} from '@dnd-kit/modifiers';
import {useLayout} from './Storage';
import {FolderSettings} from './FolderSettings';
import {FileUploader} from './FileUploader';
import {FolderTabs} from './FolderTabs';
import {MenuBar} from './MenuBar';
import {SelectableArea} from './SelectableArea';
import {DraggedInodes, InodeList} from './InodeList';
import {DroppableArea} from './Droppable';
import DownloadIcon from './icons/download.svg';
import TrashIcon from './icons/trash.svg';
import MoreVerticalIcon from './icons/more-vertical.svg';


export default function FilerAdmin(props) {
	const settings = useContext(FolderSettings);
	const menuBarRef = useRef(null);
	const folderTabsRef = useRef(null);
	const uploaderRef = useRef(null);
	const inodesRefs = Object.fromEntries(settings.ancestors.map(id => [id, useRef(null)]));
	const overlayRef = useRef(null);
	const downloadLinkRef = useRef(null);
	const [currentFolderId, setCurrentFolderId] = useState(settings.folder_id);
	const [layout, setLayout] = useLayout('tiles');
	const [activeInode, setActiveInode] = useState(null);
	const [draggedInodes, setDraggedInodes] = useState([]);
	const [isSearchResult, setSearchResult] = useState<boolean>(() => {
		const params = new URLSearchParams(window.location.search);
		return params.get('q') !== null;
	});
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

	function modifyMovement(args) {
		const {transform} = args;

		// If we are dragging multiple elements, we want to offset the drag overlay
		let offsetX = 0, offsetY = 0;
		if (overlayRef.current && draggedInodes.length > 1) {
			const firstDraggedElement = overlayRef.current.querySelector(`.inode-list [data-id="${draggedInodes[0].id}"]`);
			const activeDraggedElement = overlayRef.current.querySelector(`.inode-list [data-id="${activeInode.id}"]`);
			if (firstDraggedElement && activeDraggedElement) {
				offsetX = firstDraggedElement.getBoundingClientRect().left - activeDraggedElement.getBoundingClientRect().left;
				offsetY = firstDraggedElement.getBoundingClientRect().top - activeDraggedElement.getBoundingClientRect().top;
			}
		}

		return {
			...transform,
			x: transform.x + offsetX,
			y: transform.y + offsetY,
		};
	}

	function setCurrentFolder(folderId) {
		if (folderId !== currentFolderId) {
			deselectAll();
		}
		setCurrentFolderId(folderId);
	}

	function deselectAll(event?) {
		Object.entries(inodesRefs).forEach(([folderId, inodeRef]) => {
			inodeRef.current?.deselectInodes();
		});
		menuBarRef.current?.setSelected([]);
	}

	function downloadFiles(inodes) {
		inodes.forEach(inode => {
			downloadLinkRef.current.href = inode.download_url;
			downloadLinkRef.current.download = inode.name;
			downloadLinkRef.current.click();
		});
		deselectAll();
	}

	function handleDragStart(event) {
		const {active} = event;
		const folderId = active.data.current.folderId;
		let inodes = inodesRefs[folderId].current?.inodes ?? [];
		const multipleSelected = inodes.some(inode => inode.selected && inode.id === active.id);
		inodes = multipleSelected
			? inodes.map(inode => ({...inode, dragged: inode.selected}))
			: inodes.map(inode => ({...inode, dragged: inode.id === active.id, selected: false}));
		inodesRefs[folderId].current.setInodes(inodes);
		setDraggedInodes(inodes.filter(inode => inode.dragged));
		setActiveInode(active);
		setCurrentFolder(folderId);
	}

	async function handleDragEnd(event) {
		const {active, over} = event;
		if (!over)
			return;
		const sourceFolderId = active.data.current.folderId;
		let inodes = inodesRefs[sourceFolderId].current?.inodes ?? [];
		const [what, targetFolderId] = over.id.split(':');
		if (!draggedInodes.every(inode => inode.parent === targetFolderId)) {
			overlayRef.current.hidden = true;
			if (what === 'download') {
				downloadFiles(draggedInodes);
				setTimeout(() => {
					overlayRef.current.hidden = false;
					setDraggedInodes([]);
				}, 1000);
				return;
			}
			let fetchUrl = `${settings.base_url}${settings.folder_id}/${what === 'discard' ? 'delete' : 'move'}`;
			const response = await fetch(fetchUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-CSRFToken': settings.csrf_token,
				},
				body: JSON.stringify({
					inode_ids: draggedInodes.map(inode => inode.id),
					target_folder: targetFolderId,
				}),
			});
			if (response.ok) {
				const body = await response.json();
				if (body.inodes && inodesRefs[targetFolderId]?.current) {
					inodesRefs[targetFolderId].current.setInodes(body.inodes);
				}
				if (body.favorite_folders) {
					folderTabsRef.current.setFavoriteFolders(body.favorite_folders);
				}
				inodes = inodes.filter(inode => !inode.dragged);
				inodesRefs[sourceFolderId].current.setInodes(inodes);
			} else if (response.status === 409) {
				alert(await response.text());
			} else {
				console.error(response);
			}
			overlayRef.current.hidden = false;
		}
		inodesRefs[sourceFolderId].current.setInodes(inodes.map(inode => ({...inode, dragged: false})));
		setActiveInode(null);
		setDraggedInodes([]);
	}

	function handleDragCancel(event) {
		const {active} = event;
		const activeFolderId = active.data.current.folderId;
		const inodes = inodesRefs[activeFolderId].current.inodes;
		inodesRefs[activeFolderId].current.setInodes(inodes.map(inode => ({...inode, dragged: false})));
		setActiveInode(null);
		setDraggedInodes([]);
	}

	function renderWorkArea() {
		if (settings.is_trash) return (
			<div className={`work-area ${layout}`}>
				<SelectableArea folderId={settings.folder_id} deselectAll={deselectAll}>
					<InodeList
						ref={inodesRefs[settings.folder_id]}
						folderId={settings.folder_id}
						setCurrentFolder={setCurrentFolder}
						menuBarRef={menuBarRef}
						layout={layout}
					/>
				</SelectableArea>
			</div>
		);

		let incomplete = false;
		function renderAncestors() {
			const ancestors = [settings.ancestors[0]];
			if (layout === 'columns' && !isSearchResult && settings.workAreaRect) {
				const maxNumAncestors = Math.min(
					Math.floor(settings.workAreaRect.width / 350),
					settings.ancestors.length,
				);
				for (let i = 1; i < maxNumAncestors; i++) {
					ancestors.push(settings.ancestors[i]);
				}
				incomplete = ancestors.length < settings.ancestors.length;
			}
			let previousFolderId = null;
			return ancestors.map(folderId => {
				const snippet = (
					<FileUploader
						key={folderId}
						ref={folderId === settings.folder_id ? uploaderRef : null}
						folderId={folderId}
						handleUpload={id => inodesRefs[id].current.fetchInodes()}
					>
						<SelectableArea folderId={folderId} deselectAll={deselectAll} inodeRef={inodesRefs[folderId]}>
							<DroppableArea id={`column:${folderId}`} className="column-droppable"
										   currentId={`column:${currentFolderId}`}>
								<InodeList
									ref={inodesRefs[folderId]}
									folderId={folderId}
									previousFolderId={previousFolderId}
									setCurrentFolder={setCurrentFolder}
									menuBarRef={menuBarRef}
									folderTabsRef={folderTabsRef}
									layout={layout}
								/>
							</DroppableArea>
						</SelectableArea>
					</FileUploader>
				);
				previousFolderId = folderId;
				return snippet;
			});
		}

		return (
			<div className={`work-area ${layout}`}>
				{renderAncestors()}
				{incomplete ? <div className="trimmed-column"><MoreVerticalIcon/></div> : null}
			</div>
		);
	}

	function renderDroppables() {
		return (<>
			<DroppableArea id="download:droppable" className="download-droppable" dragging={draggedInodes.length !== 0}>
				<div className="quadrant"><DownloadIcon /></div>
			</DroppableArea>
			<a ref={downloadLinkRef} download="download" hidden />
			<DroppableArea id="discard:droppable" className="discard-droppable" dragging={draggedInodes.length !== 0}>
				<div className="quadrant"><TrashIcon /></div>
			</DroppableArea>
		</>);
	}

	console.log("FilerAdmin", currentFolderId);

	return (<>
		<MenuBar
			ref={menuBarRef}
			currentFolderId={currentFolderId}
			inodesRefs={inodesRefs}
			folderTabsRef={folderTabsRef}
			openUploader={() => uploaderRef.current.openUploader()}
			downloadFiles={downloadFiles}
			setLayout={setLayout}
			setSearchResult={setSearchResult}
		/>
		<DndContext
			onDragStart={handleDragStart}
			onDragEnd={handleDragEnd}
			onDragCancel={handleDragCancel}
			sensors={sensors}
			collisionDetection={pointerWithin}
		>
			<FolderTabs ref={folderTabsRef} isSearchResult={isSearchResult} />
			{renderWorkArea()}
			{settings.is_trash ? null : renderDroppables()}
			<div ref={overlayRef} className="drag-overlay-wrap">
				<DragOverlay className={`drag-overlay ${layout}`} style={overlayStyle} modifiers={dragModifiers}>
					<DraggedInodes inodes={draggedInodes} layout={layout} />
				</DragOverlay>
			</div>
		</DndContext>
	</>);
}
