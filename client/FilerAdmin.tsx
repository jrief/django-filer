import {useState} from 'react';
import {
	DndContext,
	PointerSensor,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
} from '@dnd-kit/core';


function File(props) {
	const { file, selectItem } = props;
	const {
		attributes,
		listeners,
		setNodeRef: setNodeRefOuter,
		transform
	} = useDraggable({
		id: file.id,
	});
	const style = {
		border: '1px solid grey',
		height: '40px',
		width: '120px',
		marginTop: '10px',
		borderColor: file.selected ? 'red' : 'grey',
	};
	if (transform) {
		console.log(transform);
		style['transform'] = `translate(${transform.x}px, ${transform.y}px)`;
	} else {
		console.log("no transform");
	}

	return (
		<div ref={setNodeRefOuter} style={style} onClick={selectItem.bind(file)} {...listeners} {...attributes}>
			{file.name}
		</div>
	);
}

function Folder(props) {
	const { folder, selectItem } = props;
	const {
		attributes,
		listeners,
		setNodeRef: setNodeRefOuter,
		transform
	} = useDraggable({
		id: folder.id,
	});
	const {
		isOver,
		active,
		setNodeRef: setNodeRefInner,
	} = useDroppable({
		id: folder.id,
	});
	const styleOuter = {
		border: '2px solid grey',
		height: '40px',
		width: '120px',
		marginTop: '10px',
		transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
		backgroundColor: isOver && active.id !== folder.id ? 'green' : undefined,
		borderColor: folder.selected ? 'red' : 'grey',
	};
	const styleInner = {
		height: '100%',
		width: '100%',
	};

	function openFolder() {
		console.log("open folder");
	}

	return (
		<div ref={setNodeRefOuter} style={styleOuter} {...listeners} {...attributes} onClick={selectItem.bind(folder)} onDoubleClick={openFolder}>
			<div ref={setNodeRefInner} style={styleInner}>
				{folder.name}
			</div>
		</div>
	);
}


export default function FilerAdmin() {
	const foldersInitial = [
		{id: 1, name: 'A', selected: false},
		{id: 2, name: 'B', selected: false},
		{id: 3, name: 'C', selected: false},
		{id: 4, name: 'D', selected: false},
	];
	const filesInitial = [
		{id: 5, name: 'a', selected: false},
		{id: 6, name: 'b', selected: false},
		{id: 7, name: 'c', selected: false},
		{id: 8, name: 'd', selected: false},
	];
	const [folders, setFolders] = useState(foldersInitial);
	const [files, setFiles] = useState(filesInitial);
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {distance: 4},
		})
	);

	function selectItem(event: PointerEvent) {
		console.log("select item");
		console.log(event);
		let modifier;
		if (event.metaKey || event.shiftKey) {
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
		setFolders(folders.map(modifier));
		setFiles(files.map(modifier));
	}

	function handleDragEnd(event) {
		const {active, over} = event;

		if (over && active.id !== over.id) {
			setFolders(folders.filter(f => f.id !== active.id));
			setFiles(files.filter(f => f.id !== active.id));
		}
	}

	return (
		<DndContext onDragEnd={handleDragEnd} sensors={sensors}>
			{folders.map(folder => (
				// We updated the Droppable component so it would accept an `id`
				// prop and pass it to `useDroppable`
				<Folder key={folder.id} folder={folder} selectItem={selectItem} />
			))}
			{files.map(file => (
				<File key={file.id} file={file} selectItem={selectItem} />
			))}
		</DndContext>
	);
}
