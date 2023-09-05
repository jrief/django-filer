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
