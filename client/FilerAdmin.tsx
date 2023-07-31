import {useState} from 'react';
import {DndContext, useDraggable, useDroppable} from '@dnd-kit/core';


function File(props) {
	const { id } = props;
	const {
		attributes,
		listeners,
		setNodeRef: setNodeRefOuter,
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
		<div ref={setNodeRefOuter} style={style} {...listeners} {...attributes}>
			{id}
		</div>
	);
}

function Folder(props) {
	const { id } = props;
	const {
		attributes,
		listeners,
		setNodeRef: setNodeRefOuter,
		transform
	} = useDraggable({
		id: id,
		data: {foo: 'bar'},
	});
	const {
		isOver,
		active,
		setNodeRef: setNodeRefInner,
	} = useDroppable({
		id: id,
	});
	const styleOuter = {
		border: '1px solid blue',
		height: '40px',
		width: '120px',
		marginTop: '10px',
		transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
		backgroundColor: isOver && active.id !== id ? 'green' : undefined,
	};
	const styleInner = {
		height: '100%',
		width: '100%',
	};

	function openFolder() {
		console.log("open folder");
	}

	return (
		<div ref={setNodeRefOuter} style={styleOuter} {...listeners} {...attributes} onDoubleClick={openFolder}>
			<div ref={setNodeRefInner} style={styleInner}>
				{id}
			</div>
		</div>
	);
}


export default function FilerAdmin() {
	const [folders, setFolders] = useState(['A', 'B', 'C']);
	const [files, setFiles] = useState(['a', 'b']);

	return (
		<DndContext onDragEnd={handleDragEnd}>
			{folders.map((id) => (
				// We updated the Droppable component so it would accept an `id`
				// prop and pass it to `useDroppable`
				<Folder key={id} id={id} />
			))}
			{files.map((id) => (
				<File key={id} id={id} />
			))}
		</DndContext>
	);

	function handleDragEnd(event) {
		const {active, over} = event;

		if (over && active.id !== over.id) {
			setFolders(folders.filter(f => f !== active.id));
			setFiles(files.filter(f => f !== active.id));
		}
	}
}
