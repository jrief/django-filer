import {useDroppable} from '@dnd-kit/core';
import React from 'react';
import CloseIcon from './icons/close.svg';
import PinIcon from './icons/pin.svg';
import RecycleIcon from './icons/recycle.svg';
import RootIcon from './icons/root.svg';
import UpIcon from './icons/folder-up.svg';


function FolderTab(props) {
	const {folder, activeFolderId} = props;
	const {
		isOver,
		setNodeRef,
	} = useDroppable({
		id: `tab:${folder.id}`,
	});
	const isActive = folder.id === activeFolderId;

	function togglePin(event) {
		props.togglePin(this.id);
		event.stopPropagation();
		event.preventDefault();
	}

	function cssClasses(folder) {
		const classes = [];
		if (isActive) {
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

	if (folder.is_root) return (
		<li ref={setNodeRef} className={cssClasses(folder)} onClick={() => !isActive ? window.location.assign(folder.change_url) : {}} title="Root folder">
			<RootIcon />
		</li>
	);

	if (folder.is_trash) return (
		<li ref={setNodeRef} className={cssClasses(folder)} onClick={() => !isActive ? window.location.assign(folder.change_url) : {}} title="Trash folder">
			<RecycleIcon />
		</li>
	);

	return (
		<li ref={setNodeRef} className={cssClasses(folder)} onClick={() => !isActive ? window.location.assign(folder.change_url) : {}} title={folder.name}>
			{folder.name}
			<span onClick={togglePin.bind(folder)}>{folder.is_pinned ? <CloseIcon /> : <PinIcon/>}</span>
		</li>
	);
}

export function FolderTabs(props) {
	const {folders, activeFolderId, togglePin, settings} = props;

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
