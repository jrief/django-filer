import React, {useRef, useState} from 'react';
import {
	DndContext,
	DragOverlay,
	PointerSensor,
	pointerWithin,
	useDroppable,
	useSensor,
	useSensors
} from '@dnd-kit/core';
import {restrictToParentElement} from '@dnd-kit/modifiers';
import {Inode, Folder, File, ListItem} from './Inode';
import DownloadIcon from './icons/download.svg';
import TrashIcon from './icons/trash.svg';


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


export function DragAndDropArea(props) {
	const {inodes, setInodes, setFavoriteFolders, selectInode, layout, settings} = props;
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
			const fetchUrl = over.id === 'recycle-droppable' ? settings.delete_inodes_url : settings.move_inodes_url;
			const response = await fetch(fetchUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-CSRFToken': settings.csrf_token,
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

	async function changeInode(newInode, persist?: boolean) {
		if (persist && newInode.dirty) {
			const response = await fetch(settings.update_inode_url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-CSRFToken': settings.csrf_token,
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
		if (inodes.findIndex(inode => inode.id === newInode.id && inode.name !== newInode.name) !== -1) {
			setInodes(inodes.map(inode => inode.id === newInode.id ? {...newInode, dirty: true} : inode));
		}
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

	//const modifiers = [modifyMovement, restrictToParentElement];
	const modifiers = [modifyMovement];
	const kwargs = {selectInode, layout, changeInode, settings};
	return (
		<DndContext
			onDragStart={handleDragStart}
			onDragEnd={handleDragEnd}
			onDragCancel={handleDragCancel}
			sensors={sensors}
			collisionDetection={pointerWithin}
		>
			<ul ref={listRef} className={`inode-list ${draggedIds ? 'dropping' : ''}`}>
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

			{settings.is_trash ? null : (<>
			<AlternativeDroppable id="download-droppable" className="download-droppable">
				<DownloadIcon />
			</AlternativeDroppable>
			<a ref={downloadLinkRef} download="download" hidden />
			<AlternativeDroppable id="recycle-droppable" className="recycle-droppable">
				<TrashIcon />
			</AlternativeDroppable>
			</>)}

			<div ref={overlayRef}>
				<DragOverlay wrapperElement="ul" className="inode-list drag-overlay" style={overlayStyle} modifiers={modifiers}>
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
