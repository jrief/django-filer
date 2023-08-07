import {useRef, useState} from 'react';
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
import {SelectableArea} from './SelectableArea';


function Inode(props) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform
	} = useDraggable({
		id: props.id,
	});

	function cssClasses() {
		let classes = [];
		if (props.selected) {
			classes.push('selected');
		}
		if (props.dragged) {
			classes.push('dragging');
		}
		return classes.join(' ');
	}

	if (props.selectItem)
		return (
			<li ref={setNodeRef} className={cssClasses()} onClick={props.selectItem.bind(props)} {...listeners} {...attributes}>
				{props.children}
			</li>
		);
	else
		return (
			<li data-id={props.id}>
				{props.name}
			</li>
		);
}


function File(props) {
	return (
		<Inode {...props}>
			{props.name}
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
	});

	function openFolder() {
		console.log("open folder");
	}

	return (
		<Inode {...props}>
			<div ref={setNodeRef} className={isOver && active.id !== props.id ? 'droppable drag-over' : 'droppable'}>
				{props.name}
			</div>
		</Inode>
	);
}


const initialInodes = [
	{id: 1, type: 'folder', name: 'A', selected: false, dragged: false},
	{id: 2, type: 'folder', name: 'B', selected: false, dragged: false},
	{id: 3, type: 'folder', name: 'C', selected: false, dragged: false},
	{id: 4, type: 'folder', name: 'D', selected: false, dragged: false},
	{id: 5, type: 'file', name: 'a', selected: false, dragged: false},
	{id: 6, type: 'file', name: 'b', selected: false, dragged: false},
	{id: 7, type: 'file', name: 'c', selected: false, dragged: false},
	{id: 8, type: 'file', name: 'd', selected: false, dragged: false},
];


export default function FilerAdmin() {
	const overlayRef = useRef(null);
	const [inodes, setInodes] = useState(initialInodes);
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
		let modifier;
		if (event.detail?.selected) {
			modifier = f => ({...f, selected: f.selected || f.id === this.id});
		} else if (event.shiftKey) {
			const selectedInodeIndex = inodes.findIndex(f => f.id === this.id);
			if (selectedInodeIndex < lastSelectedInode) {
				modifier = (f, k) => ({...f, selected: k >= selectedInodeIndex && k <= lastSelectedInode});
			} else if (selectedInodeIndex > lastSelectedInode) {
				modifier = (f, k) => ({...f, selected: k >= lastSelectedInode && k <= selectedInodeIndex});
			}
		} else if (event.altKey || event.ctrlKey || event.metaKey) {
			if (this.selected) {
				modifier = f => ({...f, selected: f.selected && f.id !== this.id});
			} else {
				modifier = f => ({...f, selected: f.selected || f.id === this.id});
			}
		} else {
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
		console.log(`Start dragging ${active.name}`);

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
					(inode.type === 'file'
					? <File key={inode.id} {...inode} selectItem={selectInode} />
					: <Folder key={inode.id} {...inode} selectItem={selectInode} />
					)
				)}
				</ul>
				<div ref={overlayRef} className="drag-overlay">
					<DragOverlay wrapperElement="ul" className="inode-list" style={overlayStyle} modifiers={[modifyMovement, restrictToParentElement]}>
					{inodes.filter(f => f.dragged).map(inode => (
						<Inode key={inode.id} {...inode} />
					))}
					</DragOverlay>
				</div>
			</DndContext>
		</SelectableArea>
	);
}
