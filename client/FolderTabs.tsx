import React from 'react';
import TrashIcon from './icons/trash-filled.svg';
import RootIcon from './icons/root.svg';


export function FolderTabs(props) {
	const {activeFolderId, folders} = props;

	return (
		<ul className="folder-tabs">
			{folders.map((folder) => (
			<li
				className={folder.id === activeFolderId ? "active" : null} key={folder.id}
				style={folder.is_trash ? {marginLeft: 'auto'} : null}
				onClick={() => window.location.assign(folder.url)}
				title={folder.is_root ? "Root folder" : folder.is_trash ? "Trash folder" : folder.name}
			>{folder.is_root ? <RootIcon /> : folder.is_trash ? <TrashIcon /> : folder.name}</li>
			))}
		</ul>
	);
}
