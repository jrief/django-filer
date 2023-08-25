import React, {useRef, useState} from 'react';
import {restrictToParentElement} from '@dnd-kit/modifiers';
import {
	DndContext,
	DragOverlay,
	PointerSensor,
	pointerWithin,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
} from '@dnd-kit/core';
import {useClipboard, useLayout} from './Storage';
import {FileUploader} from './FileUploader';
import {FolderTabs} from './FolderTabs';
import {MenuBar} from './MenuBar';
import {SelectableArea} from './SelectableArea';
import DownloadIcon from './icons/download.svg';


function Inode(props) {
	const {
		attributes,
		listeners,
		setNodeRef,
	} = useDraggable({
		id: props.id,
		disabled: props.disabled,
	});
	const [clickHandler, setClickHandler] = useState(null);

	function cssClasses() {
		let classes = [];
		if (props.disabled) {
			classes.push('disabled');
		} else if (props.selected) {
			classes.push('selected');
		} else if (props.copied) {
			classes.push('copied');
		} else if (props.cutted) {
			classes.push('cutted');
		}
		if (props.dragged) {
			classes.push('dragging');
		}
		return classes.join(' ');
	}

	function activateInode(event) {
		if (event.detail === 1) {
			setClickHandler(window.setTimeout(() => {
				props.selectInode.bind(props)(event);
				setClickHandler(null);
			}, 150));
		} else if (event.detail === 2) {
			if (clickHandler) {
				window.clearTimeout(clickHandler);
				setClickHandler(null);
			}
			props.selectInode.bind(props)(event);
		} else if (event.detail.selected) {
			console.log(event.detail);
			props.selectInode.bind(props)(event);
		}
		event.stopPropagation();
		event.preventDefault();
	}

	if (props.selectInode)
		return (
			<li ref={setNodeRef} className={cssClasses()} onClick={activateInode} {...listeners} {...attributes}>
				{props.children}
			</li>
		);
	else
		return (
			<li data-id={props.id}>
				{props.children}
			</li>
		);
}


function ListItem(props) {
	switch (props.layout) {
		case 'tiles':
			return (
				<figure>
					<img src={props.thumbnail_url} />
					<figcaption>{props.name}</figcaption>
				</figure>
			);
		case 'list':
			return (<>
				<div>
					<img src={props.thumbnail_url} />
				</div>
				<div>
					{props.owner_name}
				</div>
				<div>
					{props.details}
				</div>
				<div>{props.created_at}</div>
			</>);
		case 'columns':
			return (
				<figure>
					<img src={props.thumbnail_url} />
					<figcaption>{props.name}</figcaption>
				</figure>
			);
	}
}


function File(props) {
	return (
		<Inode {...props}>
			<ListItem {...props} />
		</Inode>
	);
}

function Folder(props) {
	const {
		isOver,
		active,
		setNodeRef,
	} = useDroppable({
		id: props.id,
		disabled: props.disabled,
	});

	function cssClasses() {
		const classes = ['droppable'];
		if (isOver && active.id !== props.id) {
			classes.push('drag-over');
		}
		if (props.disabled) {
			classes.push('disabled');
		}
		return classes.join(' ');
	}

	return (
		<Inode {...props}>
			<div ref={setNodeRef} className={cssClasses()}>
				<ListItem {...props} />
			</div>
		</Inode>
	);
}


function DownloadDroppable(props) {
	const {
		isOver,
		setNodeRef,
	} = useDroppable({
		id: 'download-droppable',
	});

	function cssClasses() {
		const classes = ['download-droppable'];
		if (isOver) {
			classes.push('drag-over');
		}
		return classes.join(' ');
	}

	return (
		<div ref={setNodeRef} className={cssClasses()}>
			<div className="quadrant"><DownloadIcon /></div>
		</div>
	);
}


function DragAndDropArea(props) {
	const {inodes, setInodes, selectInode, folderData, layout} = props;
	const [draggedIds, setDraggedIds] = useState(null);
	const downloadLinkRef = useRef(null);
	const overlayRef = useRef(null);
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {distance: 4},
		}),
	);
	const overlayStyle = {
		height: 'fit-content',
		width: 'fit-content',
	};

	function handleDragStart(event) {
		const {active} = event;
		const multiSelected = inodes.some(inode => inode.selected && inode.id === active.id);
		const draggedInodes= multiSelected
			? inodes.map(inode => ({...inode, dragged: inode.selected}))
			: inodes.map(inode => ({...inode, dragged: inode.id === active.id, selected: false}));
		const firstDraggedIndex = draggedInodes.findIndex(inode => inode.dragged);
		setDraggedIds(firstDraggedIndex !== -1 ? [draggedInodes[firstDraggedIndex].id, active.id] : null);
		setInodes(draggedInodes);
	}

	async function handleDragEnd(event) {
		const {active, over} = event;
		setDraggedIds(null);
		setInodes(inodes.map(inode => ({...inode, dragged: false})));
		if (over && active.id !== over.id) {
			const draggedInodes = inodes.filter(inode => inode.dragged);
			if (over.id === 'download-droppable')
				return downloadFiles(draggedInodes);

			const response = await fetch(folderData.move_inodes_url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-CSRFToken': folderData.csrf_token,
				},
				body: JSON.stringify({
					inodes: draggedInodes.map(inode => inode.id),
					target_folder: over.id,
				}),
			});
			if (response.status === 200) {
				const data = await response.json();
				setInodes(data.inodes);
			} else {
				console.error(response);
			}
		}
	}

	function handleDragCancel() {
		setInodes(inodes.map(inode => ({...inode, dragged: false})));
	}

	function downloadFiles(draggedInodes) {
		draggedInodes.forEach(inode => {
			downloadLinkRef.current.href = inode.url;
			downloadLinkRef.current.download = inode.name;
			downloadLinkRef.current.click();
		});
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

	function cssClasses() {
		const classes = ['inode-list', layout];
		if (draggedIds) {
			classes.push('dropping');
		}
		return classes.join(' ');
	}

	return (
		<DndContext
			onDragStart={handleDragStart}
			onDragEnd={handleDragEnd}
			onDragCancel={handleDragCancel}
			sensors={sensors}
			collisionDetection={pointerWithin}
		>
			<ul className={cssClasses()}>
			{inodes.map(inode =>
				(inode.is_folder
				? <Folder key={inode.id} {...inode} selectInode={selectInode} layout={layout} />
				: <File key={inode.id} {...inode} selectInode={selectInode} layout={layout} />
				)
			)}
			</ul>
			<DownloadDroppable />
			<a ref={downloadLinkRef} download="download" hidden />
			<div ref={overlayRef}>
				<DragOverlay wrapperElement="ul" className={`inode-list drag-overlay ${layout}`} style={overlayStyle} modifiers={[modifyMovement, restrictToParentElement]}>
				{inodes.filter(f => f.dragged).map(inode => (
					<Inode key={inode.id} {...inode}>
						<ListItem {...inode} layout={layout} />
					</Inode>
				))}
				</DragOverlay>
			</div>
		</DndContext>
	)
}


export default function FilerAdmin(props) {
	const {folderData} = props;
	const uploaderRef = useRef(null);
	const [inodes, setInodes] = useState(folderData.children);
	const [lastSelectedInode, setSelectedInode] = useState(-1);
	const [favoriteFolders, setFavoriteFolders] = useState(folderData.favorite_folders);
	const [layout, setLayout] = useLayout('tiles');
	const [clipboard, setClipboard] = useClipboard();

	function selectInode(event: PointerEvent) {
		if (this.disabled)
			return;
		let modifier;
		if (event.detail === 2) {
			// double click
			if (folderData.is_trash)
				return;  // prevent editing files in trash folder
			window.location.assign(this.url);
		} else if ((event.detail as any)?.selected) {
			// this is a SelectableArea event
			modifier = f => ({...f, selected: f.selected || f.id === this.id});
		} else if (event.shiftKey) {
			// shift click
			const selectedInodeIndex = inodes.findIndex(f => f.id === this.id);
			if (selectedInodeIndex < lastSelectedInode) {
				modifier = (f, k) => ({...f, selected: k >= selectedInodeIndex && k <= lastSelectedInode});
			} else if (selectedInodeIndex > lastSelectedInode) {
				modifier = (f, k) => ({...f, selected: k >= lastSelectedInode && k <= selectedInodeIndex});
			}
		} else if (event.altKey || event.ctrlKey || event.metaKey) {
			// alt/ctrl/meta click
			if (this.selected) {
				modifier = f => ({...f, selected: f.selected && f.id !== this.id});
			} else {
				modifier = f => ({...f, selected: f.selected || f.id === this.id});
			}
		} else {
			// simple click
			if (this.selected) {
				modifier = f => ({...f, selected: false});
			} else {
				modifier = f => ({...f, selected: f.id === this.id});
			}
			if (!this.selected) {
				// remember the last selected inode for shift-click
				setSelectedInode(inodes.findIndex(inode => inode.id === this.id));
			}
		}
		setInodes(inodes.map((f, k) => ({...modifier(f, k), cutted: false, copied: false})));
	}

	async function refreshFolder() {
		const response = await fetch(folderData.fetch_inodes_url);
		if (response.status === 200) {
			const data = await response.json();
			setInodes(data.inodes);
		} else {
			console.error(response);
		}
	}

	function deselectAll(event) {
		setInodes(inodes.map(inode => ({...inode, selected: false})));
	}

	function getSelectableElements(areaElement: HTMLElement)  {
		return areaElement.querySelectorAll('.inode-list > li');
	}

	async function addFolder() {
		const folderName = window.prompt("Enter folder name");
		if (!folderName)
			return;
		const response = await fetch(folderData.add_folder_url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-CSRFToken': folderData.csrf_token,
			},
			body: JSON.stringify({
				name: folderName,
			}),
		});
		if (response.status === 200) {
			const data = await response.json();
			setInodes([...inodes, data.new_folder]);
		} else {
			console.error(response);
		}
	}

	function copyInodes() {
		setClipboard(inodes.filter(inode => inode.selected).map(inode => ({...inode, selected: false, copied: true})));
		setInodes(inodes.map(inode => ({...inode, copied: inode.selected, selected: false})));
	}

	function cutInodes() {
		setClipboard(inodes.filter(inode => inode.selected).map(inode => ({...inode, selected: false, cutted: true})));
		setInodes(inodes.map(inode => ({...inode, cutted: inode.selected, selected: false})));
	}

	async function pasteInodes() {
		let fetchUrl;
		let pastedInodes = clipboard.filter(inode => inode.copied).map(inode => inode.id);
		if (pastedInodes.length) {
			fetchUrl = folderData.copy_inodes_url;
		} else {
			pastedInodes = clipboard.filter(inode => inode.cutted).map(inode => inode.id);
			if (pastedInodes.length) {
				fetchUrl = folderData.move_inodes_url;
			}
		}
		if (!fetchUrl)
			return;

		const response = await fetch(fetchUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-CSRFToken': folderData.csrf_token,
			},
			body: JSON.stringify({
				inodes: pastedInodes
			}),
		});
		if (response.status === 200) {
			const data = await response.json();
			setInodes(data.inodes);
			setFavoriteFolders(data.favorite_folders);
			setClipboard([]);
		}
	}

	async function deleteInodes() {
		setClipboard([]);
		const selectedInodes = inodes.filter(inode => inode.selected).map(inode => inode.id);
		const response = await fetch(folderData.delete_inodes_url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-CSRFToken': folderData.csrf_token,
			},
			body: JSON.stringify({
				inodes: selectedInodes
			}),
		});
		if (response.status === 200) {
			const data = await response.json();
			setInodes(data.inodes);
			setFavoriteFolders(data.favorite_folders);
		}
	}

	async function eraseTrashFolder() {
		setClipboard([]);
		const response = await fetch(folderData.erase_trash_folder_url, {
			method: 'DELETE',
			headers: {
				'X-CSRFToken': folderData.csrf_token,
			},
		});
		if (response.status === 200) {
			const data = await response.json();
			window.location.assign(data.success_url);
		}
	}

	async function togglePin(pinnedId) {
		const response = await fetch(folderData.toggle_pin_url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-CSRFToken': folderData.csrf_token,
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

	return (<>
		<MenuBar
			clipboard={clipboard}
			parentUrl={folderData.parent_url}
			addFolder={addFolder}
			openUploader={() => uploaderRef.current.openUploader()}
			setLayout={setLayout}
			copyInodes={copyInodes}
			cutInodes={cutInodes}
			pasteInodes={pasteInodes}
			deleteInodes={deleteInodes}
			eraseTrashFolder={eraseTrashFolder}
			isRoot={folderData.is_root}
			isTrash={folderData.is_trash}
			numSelected={inodes.filter(inode => inode.selected).length}
		/>
		<FolderTabs activeFolderId={folderData.id} folders={favoriteFolders} togglePin={togglePin} />
		<div className="work-area">
		{folderData.is_trash ? (
			<SelectableArea selectableElements={getSelectableElements} deselectAll={deselectAll} isTrash={true}>
				<DragAndDropArea
					inodes={inodes}
					setInodes={setInodes}
					selectInode={selectInode}
					folderData={folderData}
					layout={layout}
				/>
			</SelectableArea>
		) : (
			<FileUploader ref={uploaderRef} folderData={folderData} refreshFolder={refreshFolder}>
				<SelectableArea selectableElements={getSelectableElements} deselectAll={deselectAll}>
					<DragAndDropArea
						inodes={inodes}
						setInodes={setInodes}
						selectInode={selectInode}
						folderData={folderData}
						layout={layout}
					/>
				</SelectableArea>
			</FileUploader>
		)}
		</div>
	</>);
}
