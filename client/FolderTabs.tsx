import {useDroppable} from '@dnd-kit/core';
import React from 'react';
import PinIcon from './icons/pin.svg';
import UnpinIcon from './icons/unpin.svg';
import RecycleIcon from './icons/recycle.svg';
import RootIcon from './icons/root.svg';


function FolderTab(props) {
	const {folder, activeFolderId} = props;
	const {
		isOver,
		setNodeRef,
	} = useDroppable({
		id: `tab:${folder.id}`,
	});

	function togglePin(event) {
		console.log(this);
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

	return (
		<li
			ref={setNodeRef}
			className={cssClasses(folder)}
			onClick={() => window.location.assign(folder.url)}
			title={folder.is_root ? "Root folder" : folder.is_trash ? "Trash folder" : folder.name}
		>
			{folder.is_root ? <RootIcon /> : folder.is_trash ? <RecycleIcon /> : folder.name}
			{folder.is_root || folder.is_trash ? null : <span onClick={togglePin.bind(folder)}>{folder.is_pinned ? <UnpinIcon /> : <PinIcon/>}</span>}
		</li>
	)
}

export function FolderTabs(props) {
	const {folders, activeFolderId, togglePin} = props;

	return (
		<ul className="folder-tabs">
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
