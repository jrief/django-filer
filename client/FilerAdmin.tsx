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
import TrashIcon from './icons/trash.svg';


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
			<li ref={setNodeRef} data-id={props.id} className={cssClasses()} onClick={activateInode} {...listeners} {...attributes}>
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
	const [focusHandler, setFocusHandler] = useState(null);

	function handleFocus(event) {
		// enforce two slow clicks to focus the textarea
		if (!(event.target instanceof HTMLTextAreaElement))
			return;
		if (!focusHandler) {
			event.target.blur();
		}
		setFocusHandler(window.setTimeout(() => {
			if (focusHandler) {
				window.clearTimeout(focusHandler);
			}
			setFocusHandler(null);
		}, 1500));
	}

	function changeName(event) {
		if (event.target.value !== props.name) {
			props.changeInode({...props, name: event.target.value});
		} else if (event.type === 'blur') {
			props.changeInode(props, true);
		}
	}

	switch (props.layout) {
		case 'tiles':
			return (
				<figure>
					<img src={props.thumbnail_url} />
					<figcaption>
						{!props.folderData || props.folderData.is_trash ? (
						<span>{props.name}</span>
						) : (
						<textarea name={`inode-${props.id}`} value={props.name} onFocus={handleFocus} onChange={changeName} onBlur={changeName}></textarea>
						)}
					</figcaption>
				</figure>
			);
		case 'list':
			return (<>
				<div>
					<img src={props.thumbnail_url} />
				</div>
				<div>
				{!props.folderData || props.folderData.is_trash ? (
					props.name
				) : (
					<textarea name={`inode-${props.id}`} value={props.name} onChange={changeName} onFocus={handleFocus} onBlur={changeName}></textarea>
				)}
				</div>
				<div>
					{props.owner_name}
				</div>
				<div>
					{props.details}
				</div>
				<div>{props.created_at}</div>
				<div>{props.mime_type}</div>
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
			<div className="inode">
				<ListItem {...props} />
			</div>
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
		const classes = ['inode'];
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


function AlternativeDroppable(props) {
	const {id, className, children} = props;
	const {
		isOver,
		setNodeRef,
	} = useDroppable({
		id: id,
	});

	function cssClasses() {
		const classes = [className];
		if (isOver) {
			classes.push('drag-over');
		}
		return classes.join(' ');
	}

	return (
		<div ref={setNodeRef} className={cssClasses()}>
			<div className="quadrant">{children}</div>
		</div>
	);
}


function DragAndDropArea(props) {
	const {inodes, setInodes, setFavoriteFolders, selectInode, folderData, layout} = props;
	const listRef = useRef(null);
	const downloadLinkRef = useRef(null);
	const overlayRef = useRef(null);
	const [draggedIds, setDraggedIds] = useState(null);
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
		console.log(draggedInodes);
	}

	async function handleDragEnd(event) {
		const {active, over} = event;
		setDraggedIds(null);
		setInodes(inodes.map(inode => ({...inode, dragged: false})));
		if (over && active.id !== over.id) {
			const draggedInodes = inodes.filter(inode => inode.dragged);
			if (over.id === 'download-droppable')
				return downloadFiles(draggedInodes);
			const fetchUrl = over.id === 'recycle-droppable' ? folderData.delete_inodes_url : folderData.move_inodes_url;
			const response = await fetch(fetchUrl, {
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
				setFavoriteFolders(data.favorite_folders);
			} else {
				console.error(response);
			}
		}
	}

	function handleDragCancel() {
		setInodes(inodes.map(inode => ({...inode, dragged: false})));
	}

	async function changeInode(newInode, persit?: boolean) {
		const currentInode = inodes.filter(inode => inode.id === newInode.id)[0];
		if (currentInode.name === newInode.name)
			return;
		if (persit) {
			const response = await fetch(newInode.url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-CSRFToken': folderData.csrf_token,
				},
				body: JSON.stringify(newInode),
			});
			if (response.status === 200) {
				const data = await response.json();
				setInodes(data.inodes);
				setFavoriteFolders(data.favorite_folders);
			} else {
				console.error(response);
			}
		}
		setInodes(inodes.map(inode => inode.id === newInode.id ? newInode : inode));
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

	const kwargs = {
		selectInode, layout, changeInode, folderData
	};

	return (
		<DndContext
			onDragStart={handleDragStart}
			onDragEnd={handleDragEnd}
			onDragCancel={handleDragCancel}
			sensors={sensors}
			collisionDetection={pointerWithin}
		>
			<ul ref={listRef} className={cssClasses()}>
			{layout === 'list' ? (
				<li className="header">
					<div className="inode">
						<div></div>
						<div>Name</div>
						<div>Owner</div>
						<div>Details</div>
						<div>Created at</div>
						<div>Mime type</div>
					</div>
				</li>
			) : null}
			{inodes.map(inode =>
				(inode.is_folder
				? <Folder key={inode.id} {...inode} {...kwargs} />
				: <File key={inode.id} {...inode} {...kwargs} />
				)
			)}
			</ul>

			{folderData.is_trash ? null : (<>
			<AlternativeDroppable id="download-droppable" className="download-droppable">
				<DownloadIcon />
			</AlternativeDroppable>
			<a ref={downloadLinkRef} download="download" hidden />
			<AlternativeDroppable id="recycle-droppable" className="recycle-droppable">
				<TrashIcon />
			</AlternativeDroppable>
			</>)}

			<div ref={overlayRef}>
				<DragOverlay wrapperElement="ul" className={`inode-list drag-overlay ${layout}`} style={overlayStyle} modifiers={[modifyMovement, restrictToParentElement]}>
				{inodes.filter(f => f.dragged).map(inode => (
					<Inode key={inode.id} {...inode}>
						<div className="inode">
							<ListItem {...inode} layout={layout} />
						</div>
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
	const [inodes, setInodes] = useState(folderData.inodes);
	const [lastSelectedInode, setSelectedInode] = useState(-1);
	const [favoriteFolders, setFavoriteFolders] = useState(folderData.favorite_folders);
	const [panels, setPanels] = useState([]);
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

	function switchLayout(newLayout: string) {
		setLayout(newLayout);
		if (newLayout !== layout && newLayout === 'columns') {
			window.location.reload();
		}
	}

	const kwargs = {inodes, setInodes, selectInode, folderData, layout};
	return (<>
		<MenuBar
			clipboard={clipboard}
			parentUrl={folderData.parent_url}
			addFolder={addFolder}
			openUploader={() => uploaderRef.current.openUploader()}
			setLayout={switchLayout}
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
				<DragAndDropArea {...kwargs} />
			</SelectableArea>
		) : (

			<FileUploader ref={uploaderRef} folderData={folderData} refreshFolder={refreshFolder}>
				<SelectableArea selectableElements={getSelectableElements} deselectAll={deselectAll}>
					<DragAndDropArea {...kwargs} setFavoriteFolders={setFavoriteFolders} />
				</SelectableArea>
			</FileUploader>
		)}
		</div>
	</>);
}
