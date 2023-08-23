import React from 'react';
import TrashIcon from './icons/trash-filled.svg';
import RootIcon from './icons/root.svg';


export function FolderTabs(props) {
	const {activeFolderId, folders} = props;

	function cssClasses(folder) {
		const classes = [];
		if (folder.id === activeFolderId) {
			classes.push('active');
		}
		if (folder.is_trash) {
			classes.push('trash');
		}
		return classes.join(' ');
	}

	return (
		<ul className="folder-tabs">
			{folders.map((folder) => (
			<li
				className={cssClasses(folder)} key={folder.id}
				onClick={() => window.location.assign(folder.url)}
				title={folder.is_root ? "Root folder" : folder.is_trash ? "Trash folder" : folder.name}
			>{folder.is_root ? <RootIcon /> : folder.is_trash ? <TrashIcon /> : folder.name}</li>
			))}
		</ul>
	);
}
