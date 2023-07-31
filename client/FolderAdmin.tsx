import {useState} from 'react';
import {DndContext, pointerWithin, useDraggable, useDroppable} from '@dnd-kit/core';


function Draggable(props) {
	const { children, id } = props;
	const {
		attributes,
		listeners,
		setNodeRef,
		transform
	} = useDraggable({
		id: id,
		data: {foo: 'bar'},
	});
	const style = {
		border: '1px solid blue',
		height: '40px',
		width: '120px',
		marginTop: '10px',
	};
	if (transform) {
		style['transform'] = `translate(${transform.x}px, ${transform.y}px)`;
	}
	return (
		<div ref={setNodeRef} style={style} {...listeners} {...attributes}>
			{children}
		</div>
	);
}


function Droppable(props) {
	const { children, id } = props;
	const {
		isOver,
		active,
		setNodeRef
	} = useDroppable({
		id: id,
	});
	const validTarget = isOver && active.id !== id;
	const style = {
		backgroundColor: validTarget ? 'green' : undefined,
		height: '100%',
		width: '100%',
	};
	return (
		<div ref={setNodeRef} style={style}>
			{children}
		</div>
	);
}

function Folder(props) {
	const { children, id } = props;

	return (
		<Draggable id={id}>
			<Droppable id={id}>
				{id}
			</Droppable>
		</Draggable>
	);
}


export default function FolderAdmin() {
	const [files, setFiles] = useState(['a', 'b']);
	const [folders, setFolders] = useState(['A', 'B', 'C']);

	return (
		<DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={pointerWithin}>
			{folders.map((id) => (
				// We updated the Droppable component so it would accept an `id`
				// prop and pass it to `useDroppable`
				<Folder key={id} id={id} />
			))}
			{files.map((id) => (
				<Draggable key={id} id={id}>{id}</Draggable>
			))}
		</DndContext>
	);

	function handleDragStart(event) {
		const {active} = event;
		console.log(active);
	}

	function handleDragEnd(event) {
		const {active, over} = event;
		console.log(active, over);

		if (over && active.id !== over.id) {
			setFolders(folders.filter(f => f !== active.id));
			setFiles(files.filter(f => f !== active.id));
		}
	}
}
