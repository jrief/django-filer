import React, {useRef, useState} from 'react';
import {useClipboard, useLayout} from './Storage';
import {FileUploader} from './FileUploader';
import {FolderTabs} from './FolderTabs';
import {MenuBar} from './MenuBar';
import {SelectableArea} from './SelectableArea';


export default function FilerAdmin(props) {
	const {settings} = props;
	const uploaderRef = useRef(null);
	const [ancestors, setAncestors] = useState(settings.ancestors);
	const [favoriteFolders, setFavoriteFolders] = useState(settings.favorite_folders);
	const [currentDepth, setCurrentDepth] = useState(0);
	const [layout, setLayout] = useLayout('tiles');
	const [clipboard, setClipboard] = useClipboard();

	function setInodes(inodes) {
		setAncestors(ancestors.map((ancestor, depth) => {
			if (depth === currentDepth)
				return inodes;
			return ancestor.map(inode => ({...inode, selected: false, cutted: false, copied: false}));
		}));
	}

	async function refreshFolder() {
		const response = await fetch(settings.fetch_inodes_url);
		if (response.status === 200) {
			const data = await response.json();
			setInodes(data.inodes);
		} else {
			console.error(response);
		}
	}

	function deselectAll(event) {
		// const inodes = ancestors[currentDepth];
		// setInodes(inodes.map(inode => ({...inode, selected: false})));
		setAncestors(ancestors.map(ancestor => ancestor.map(inode => ({...inode, selected: false}))));
	}

	async function addFolder() {
		const folderName = window.prompt("Enter folder name");
		const inodes = ancestors[currentDepth];
		if (!folderName)
			return;
		const response = await fetch(settings.add_folder_url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-CSRFToken': settings.csrf_token,
			},
			body: JSON.stringify({
				name: folderName,
			}),
		});
		if (response.status === 200) {
			const data = await response.json();
			setInodes([...inodes, data.new_folder]);
		} else {
			console.error(response);
		}
	}

	function copyInodes() {
		const inodes = ancestors[currentDepth];
		setClipboard(inodes.filter(inode => inode.selected).map(inode => ({...inode, selected: false, copied: true})));
		setInodes(inodes.map(inode => ({...inode, copied: inode.selected, selected: false})));
	}

	function cutInodes() {
		const inodes = ancestors[currentDepth];
		setClipboard(inodes.filter(inode => inode.selected).map(inode => ({...inode, selected: false, cutted: true})));
		setInodes(inodes.map(inode => ({...inode, cutted: inode.selected, selected: false})));
	}

	async function pasteInodes() {
		let fetchUrl;
		let pastedInodes = clipboard.filter(inode => inode.copied).map(inode => inode.id);
		if (pastedInodes.length) {
			fetchUrl = settings.copy_inodes_url;
		} else {
			pastedInodes = clipboard.filter(inode => inode.cutted).map(inode => inode.id);
			if (pastedInodes.length) {
				fetchUrl = settings.move_inodes_url;
			}
		}
		if (!fetchUrl)
			return;

		const response = await fetch(fetchUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-CSRFToken': settings.csrf_token,
			},
			body: JSON.stringify({
				inodes: pastedInodes
			}),
		});
		if (response.status === 200) {
			const data = await response.json();
			setInodes(data.inodes);
			setFavoriteFolders(data.favorite_folders);
			setClipboard([]);
		}
	}

	async function deleteInodes() {
		setClipboard([]);
		const inodes = ancestors[currentDepth];
		const selectedInodes = inodes.filter(inode => inode.selected).map(inode => inode.id);
		const response = await fetch(settings.delete_inodes_url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-CSRFToken': settings.csrf_token,
			},
			body: JSON.stringify({
				inodes: selectedInodes
			}),
		});
		if (response.status === 200) {
			const data = await response.json();
			setInodes(data.inodes);
			setFavoriteFolders(data.favorite_folders);
		}
	}

	async function eraseTrashFolder() {
		setClipboard([]);
		const response = await fetch(settings.erase_trash_folder_url, {
			method: 'DELETE',
			headers: {
				'X-CSRFToken': settings.csrf_token,
			},
		});
		if (response.status === 200) {
			const data = await response.json();
			window.location.assign(data.success_url);
		}
	}

	async function togglePin(pinnedId) {
		const response = await fetch(settings.toggle_pin_url, {
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

	function switchLayout(newLayout: string) {
		setLayout(newLayout);
		if (newLayout !== layout && newLayout === 'columns') {
			window.location.reload();
		}
	}

	const kwargs = {settings, setFavoriteFolders, deselectAll, setInodes, setCurrentDepth};
	return (<>
		<MenuBar
			clipboard={clipboard}
			parentUrl={settings.parent_url}
			addFolder={addFolder}
			openUploader={() => uploaderRef.current.openUploader()}
			setLayout={switchLayout}
			copyInodes={copyInodes}
			cutInodes={cutInodes}
			pasteInodes={pasteInodes}
			deleteInodes={deleteInodes}
			eraseTrashFolder={eraseTrashFolder}
			isRoot={settings.is_root}
			isTrash={settings.is_trash}
			numSelected={ancestors[currentDepth].filter(inode => inode.selected).length}
		/>
		<FolderTabs activeFolderId={settings.id} folders={favoriteFolders} togglePin={togglePin} />
		{settings.is_trash ? (
		<div className="work-area tiles">
			<SelectableArea {...kwargs} inodes={ancestors[0]} layout="tiles" />
		</div>
		) : (
		<div className={`work-area ${layout}`}>
			{layout === 'columns' ? ancestors.map((inodes, depth) => (
			<FileUploader ref={uploaderRef} key={depth} settings={settings} refreshFolder={refreshFolder}>
				<SelectableArea {...kwargs} inodes={inodes} layout={layout} />
			</FileUploader>
			)) : (
			<FileUploader ref={uploaderRef} settings={settings} refreshFolder={refreshFolder}>
				<SelectableArea {...kwargs} inodes={ancestors[0]} layout={layout} />
			</FileUploader>
			)}
		</div>
		)}
	</>);
}
