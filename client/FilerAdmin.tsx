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


function File(props) {
	const { file, selectItem } = props;
	const {
		attributes,
		listeners,
		setNodeRef,
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
		borderStyle: selectItem ? 'solid' :  'dotted',
		visibility: file.dragged && selectItem ? 'hidden' : 'visible',
	};
	if (transform) {
		style['transform'] = `translate(${transform.x}px, ${transform.y}px)`;
	}

	if (selectItem)
		return (
			<div ref={setNodeRef} style={style} onClick={selectItem.bind(file)} {...listeners} {...attributes}>
				{file.name}
			</div>
		);
	else
		return (
			<div style={style}>
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
		borderStyle: selectItem ? 'solid' :  'dotted',
		visibility: folder.dragged && selectItem ? 'hidden' : 'visible',
	};
	const styleInner = {
		height: '100%',
		width: '100%',
	};

	function openFolder() {
		console.log("open folder");
	}

	if (selectItem)
		return (
			<div ref={setNodeRefOuter} style={styleOuter} {...listeners} {...attributes} onClick={selectItem.bind(folder)} onDoubleClick={openFolder}>
				<div ref={setNodeRefInner} style={styleInner}>
					{folder.name}
				</div>
			</div>
		);
	else
		return (
			<div style={styleOuter}>
				<div style={styleInner}>
					{folder.name}
				</div>
			</div>
		)
}


const foldersInitial = [
	{id: 1, name: 'A', selected: false, dragged: false},
	{id: 2, name: 'B', selected: false, dragged: false},
	{id: 3, name: 'C', selected: false, dragged: false},
	{id: 4, name: 'D', selected: false, dragged: false},
];
const filesInitial = [
	{id: 5, name: 'a', selected: false, dragged: false},
	{id: 6, name: 'b', selected: false, dragged: false},
	{id: 7, name: 'c', selected: false, dragged: false},
	{id: 8, name: 'd', selected: false, dragged: false},
];


export default function FilerAdmin() {
	const [folders, setFolders] = useState(foldersInitial);
	const [files, setFiles] = useState(filesInitial);
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {distance: 4},
		})
	);
	let lastSelectedFolder, lastSelectedFile: number = -1;

	function selectItem(event: PointerEvent) {
		console.log("select item");
		console.log(event);
		let modifier;
		if (event.shiftKey) {
			const selectedFolderIndex = folders.findIndex(f => f.id === this.id);
			const selectedFileIndex = files.findIndex(f => f.id === this.id);
			return;
		}
		if (event.altKey || event.ctrlKey || event.metaKey) {
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
			lastSelectedFolder = folders.findIndex(f => f.id === this.id);
			lastSelectedFile = files.findIndex(f => f.id === this.id);
		}
		setFolders(folders.map(modifier));
		setFiles(files.map(modifier));
	}

	function handleDragStart(event) {
		const {active} = event;
		console.log(active.id);
		const modifier = f => ({...f, dragged: f.selected || f.id === active.id});
		setFolders(folders.map(modifier));
		setFiles(files.map(modifier));
	}

	function handleDragEnd(event) {
		const {active, over} = event;
		const modifier = f => ({...f, dragged: false});
		setFiles(files.map(modifier));
		setFolders(folders.map(modifier));
		if (over && active.id !== over.id) {
			const condition = f => !f.dragged && f.id !== active.id;
			setFolders(folders.filter(condition));
			setFiles(files.filter(condition));
		}
	}

	function handleDragCancel(event) {
		const modifier = f => ({...f, dragged: false});
		setFolders(folders.map(modifier));
		setFiles(files.map(modifier));
	}

	const styleOverlay = {
		backgroundColor: 'rgba(255, 255, 198, 0.3)',
		transform: 'translate(-50%, -50%)',
		width: 'max-content',
		height: 'max-content',
	};

	return (
		<DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel} sensors={sensors}>
			{folders.map(folder => (
				<Folder key={folder.id} folder={folder} selectItem={selectItem} />
			))}
			{files.map(file => (
				<File key={file.id} file={file} selectItem={selectItem} />
			))}
			<DragOverlay>
				<div style={styleOverlay}>
					{folders.filter(f => f.dragged).map(folder => (
						<Folder key={folder.id} folder={folder} />
					))}
					{files.filter(f => f.dragged).map(file => (
						<File key={file.id} file={file} />
					))}
				</div>
			</DragOverlay>
		</DndContext>
	);
}
