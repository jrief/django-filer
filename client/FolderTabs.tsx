import {useDroppable} from '@dnd-kit/core';
import React, {useContext, useTransition} from 'react';
import CloseIcon from './icons/close.svg';
import PinIcon from './icons/pin.svg';
import RecycleIcon from './icons/recycle.svg';
import RootIcon from './icons/root.svg';
import UpIcon from './icons/folder-up.svg';
import {FolderSettings} from "./FolderSettings";


function FolderTab(props) {
	const [isPending, startTransition] = useTransition();
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

	function selectTab(event) {
		if (!isActive) {
			startTransition(() => {
				window.location.assign(folder.change_url);
			});
		}
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
		<li ref={setNodeRef} className={cssClasses(folder)} onClick={selectTab} title={folder.name}>
			{folder.name}
			<span onClick={togglePin.bind(folder)}>{folder.is_pinned ? <CloseIcon /> : <PinIcon/>}</span>
		</li>
	);
}

export function FolderTabs(props) {
	const settings = useContext(FolderSettings);
	const {favoriteFolders, setFavoriteFolders, activeFolderId} = props;

	async function togglePin(pinnedId) {
		const togglePinUrl = `${settings.base_url}${settings.folder_id}/toggle_pin`;
		const response = await fetch(togglePinUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-CSRFToken': settings.csrf_token,
			},
			body: JSON.stringify({
				pinned_id: pinnedId
			}),
		});
		if (response.status === 200) {
			const data = await response.json();
			if (data.success_url) {
				// unpinned current folder, redirect to success_url
				window.location.assign(data.success_url);
				return;
			}
			setFavoriteFolders(data.favorite_folders);
		}
	}

	return (
		<ul className="folder-tabs">
			{settings.parent_url ? <li><a href={settings.parent_url}><UpIcon /></a></li> : null}
			{favoriteFolders.map(folder =>
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
