import {useState} from 'react';
import {
	DndContext,
	DragOverlay,
	PointerSensor,
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
		transform
	} = useDraggable({
		id: props.id,
	});
	const style = {
		border: '1px solid grey',
		height: '40px',
		width: '120px',
		marginTop: '10px',
		borderColor: props.selected ? 'red' : 'grey',
		borderStyle: props.selectItem ? 'solid' :  'dotted',
		visibility: props.dragged && props.selectItem ? 'hidden' : 'visible',
	};
	if (transform) {
		style['transform'] = `translate(${transform.x}px, ${transform.y}px)`;
	}

	if (props.selectItem)
		return (
			<div ref={setNodeRef} style={style} onClick={props.selectItem.bind(props)} {...listeners} {...attributes}>
				{props.children}
			</div>
		);
	else
		return (
			<div style={style}>
				{props.name}
			</div>
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
		setNodeRef: setNodeRefInner,
	} = useDroppable({
		id: props.id,
	});
	const style = {
		height: '100%',
		width: '100%',
		backgroundColor: isOver && active.id !== props.id ? 'green' : undefined
	};

	function openFolder() {
		console.log("open folder");
	}

	return (
		<Inode {...props}>
			<div ref={setNodeRefInner} style={style}>
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
	const [inodes, setInodes] = useState(initialInodes);
	const [lastSelectedInode, setSelectedInode] = useState(-1);
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {distance: 4},
		})
	);

	function selectInode(event: PointerEvent) {
		let modifier;
		if (event.shiftKey) {
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
		setInodes(inodes.map(f => ({...f, dragged: f.selected || f.id === active.id})));
	}

	function handleDragEnd(event) {
		const {active, over} = event;
		setInodes(inodes.map(f => ({...f, dragged: false})));
		if (over && active.id !== over.id) {
			setInodes(inodes.filter(f => !f.dragged && f.id !== active.id));
		}
	}

	function handleDragCancel(event) {
		setInodes(inodes.map(f => ({...f, dragged: false})));
	}

	const styleOverlay = {
		backgroundColor: 'rgba(255, 255, 198, 0.3)',
		//transform: 'translate(0, -50%)',
		width: 'max-content',
		height: 'max-content',
	};

	return (
		<DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel} sensors={sensors}>
			{inodes.map(inode =>
				(inode.type === 'file'
				? <File key={inode.id} {...inode} selectItem={selectInode} />
				: <Folder key={inode.id} {...inode} selectItem={selectInode} />
				)
			)}
			<DragOverlay>
				<div style={styleOverlay}>
					{inodes.filter(f => f.dragged).map(inode => (
						<Inode key={inode.id} {...inode} />
					))}
				</div>
			</DragOverlay>
		</DndContext>
	);
}
