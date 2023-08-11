import React, {useRef, useState} from 'react';
import {restrictToParentElement} from '@dnd-kit/modifiers';
import {SelectableArea} from './SelectableArea';
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
		if (props.selected) {
			classes.push('selected');
		}
		if (props.dragged) {
			classes.push('dragging');
		}
		if (props.disabled) {
			classes.push('disabled');
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


function File(props) {
	return (
		<Inode {...props}>
			<figure>
				<img src={props.thumbnail} />
				<figcaption>{props.name}</figcaption>
			</figure>
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

	return (
		<Inode {...props}>
			<div ref={setNodeRef} className={isOver && active.id !== props.id ? 'droppable drag-over' : 'droppable'}>
				<figure>
					<img src={props.thumbnail} />
					<figcaption>{props.name}</figcaption>
				</figure>
			</div>
		</Inode>
	);
}


export default function FilerAdmin(props) {
	const folderData = props.folderData;
	const overlayRef = useRef(null);
	const [inodes, setInodes] = useState(folderData.children);
	const [lastSelectedInode, setSelectedInode] = useState(-1);
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

	function selectInode(event: PointerEvent) {
		if (this.disabled)
			return;
		let modifier;
		if (event.detail === 2) {
			// double click
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
		}
		if (!this.selected) {
			setSelectedInode(inodes.findIndex(f => f.id === this.id));
		}
		setInodes(inodes.map(modifier));
	}

	function handleDragStart(event) {
		const {active} = event;
		const multiSelected = inodes.some(f => f.selected && f.id === active.id);
		const draggedInodes= multiSelected
			? inodes.map(f => ({...f, dragged: f.selected}))
			: inodes.map(f => ({...f, dragged: f.id === active.id, selected: false}));
		const firstDraggedIndex = draggedInodes.findIndex(f => f.dragged);
		setDraggedIds(firstDraggedIndex !== -1 ? [draggedInodes[firstDraggedIndex].id, active.id] : null);
		setInodes(draggedInodes);
	}

	function handleDragEnd(event) {
		const {active, over} = event;
		setInodes(inodes.map(f => ({...f, dragged: false})));
		if (over && active.id !== over.id) {
			setInodes(inodes.filter(f => !f.dragged && f.id !== active.id));
		}
	}

	function handleDragCancel() {
		setInodes(inodes.map(f => ({...f, dragged: false})));
	}

	function getSelectableElements(areaElement: HTMLElement)  {
		return areaElement.querySelectorAll('.inode-list > li');
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

	return (
		<SelectableArea selectableElements={getSelectableElements}>
			<DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel} sensors={sensors} collisionDetection={pointerWithin}>
				<ul className="inode-list">
				{inodes.map(inode =>
					(inode.is_folder
					? <Folder key={inode.id} {...inode} selectInode={selectInode} />
					: <File key={inode.id} {...inode} selectInode={selectInode} />
					)
				)}
				</ul>
				<div ref={overlayRef} className="drag-overlay">
					<DragOverlay wrapperElement="ul" className="inode-list" style={overlayStyle} modifiers={[modifyMovement, restrictToParentElement]}>
					{inodes.filter(f => f.dragged).map(inode => (
						<Inode key={inode.id} {...inode}>
							<figure>
								<img src={inode.thumbnail} />
								<figcaption>{inode.name}</figcaption>
							</figure>
						</Inode>
					))}
					</DragOverlay>
				</div>
			</DndContext>
		</SelectableArea>
	);
}
