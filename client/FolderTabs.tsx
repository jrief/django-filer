import {useDroppable} from '@dnd-kit/core';
import React from 'react';
import PinIcon from './icons/pin.svg';
import UnpinIcon from './icons/unpin.svg';
import RecycleIcon from './icons/recycle.svg';
import RootIcon from './icons/root.svg';
import UpIcon from './icons/up.svg';


function FolderTab(props) {
	const {folder, activeFolderId} = props;
	const {
		isOver,
		setNodeRef,
	} = useDroppable({
		id: `tab:${folder.id}`,
	});

	function togglePin(event) {
		props.togglePin(this.id);
		event.stopPropagation();
		event.preventDefault();
	}

	function cssClasses(folder) {
		const classes = [];
		if (folder.id === activeFolderId) {
			classes.push('active');
		}
		if (folder.is_trash) {
			classes.push('trash');
		}
		if (isOver) {
			classes.push('drag-over');
		}
		return classes.join(' ');
	}

	function renderFolder(folder) {
		return (<>
			{folder.name}
			<span onClick={togglePin.bind(folder)}>{folder.is_pinned ? <UnpinIcon /> : <PinIcon/>}</span>
		</>);
	}

	return (
		<li
			ref={setNodeRef}
			className={cssClasses(folder)}
			onClick={() => window.location.assign(folder.url)}
			title={folder.is_root ? "Root folder" : folder.is_trash ? "Trash folder" : folder.name}
		>{
			folder.is_root ? <RootIcon /> : folder.is_trash ? <RecycleIcon /> : renderFolder(folder)
		}</li>
	);
}

export function FolderTabs(props) {
	const {folders, activeFolderId, togglePin} = props;

	return (
		<ul className="folder-tabs">
			{folders[0].is_root ? null : <li><a href={props.parentUrl}><UpIcon /></a></li>}
			{folders.map(folder =>
				<FolderTab
					key={folder.id}
					folder={folder}
					activeFolderId={activeFolderId}
					togglePin={togglePin}
				/>
			)}
		</ul>
	);
}
