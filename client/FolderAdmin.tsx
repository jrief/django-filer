import {useState} from 'react';
import {DndContext, useDraggable, useDroppable} from '@dnd-kit/core';


function Draggable(props) {
	const { children, id } = props;
	const {attributes, listeners, setNodeRef, transform} = useDraggable({
		id: id,
	});
	const style = {
		border: '1px solid blue',
		height: '40px',
		width: '80px',
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
	const {attributes, listeners, transform} = useDraggable({
		id: id,
	});
	const {isOver, setNodeRef} = useDroppable({
		id: id,
	});
	const style = {
		border: '1px solid grey',
		color: isOver ? 'green' : undefined,
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

export default function FolderAdmin() {
	const containers = ['A', 'B', 'C'];
	const [parent, setParent] = useState(null);
	const draggableMarkup = (
		<Draggable id="0">Drag me</Draggable>
	);

	return (
		<DndContext onDragEnd={handleDragEnd}>
			{parent === null ? draggableMarkup : null}

			{containers.map((id) => (
				// We updated the Droppable component so it would accept an `id`
				// prop and pass it to `useDroppable`
				<Droppable key={id} id={id}>
				  {parent === id ? draggableMarkup : `Drop over ${id}`}
				</Droppable>
			))}
		</DndContext>
	);

	function handleDragEnd(event) {
		const {active, over} = event;
		// debugger;

		// If the item is dropped over a container, set it as the parent
		// otherwise reset the parent to `null`
		setParent(over ? over.id : null);
	}
}
