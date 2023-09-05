import React, {useRef, useState} from 'react';
import {useClipboard, useLayout} from './Storage';
import {FileUploader} from './FileUploader';
import {FolderTabs} from './FolderTabs';
import {MenuBar} from './MenuBar';
import {SelectableArea} from './SelectableArea';


export default function FilerAdmin(props) {
	const {folderData} = props;
	const uploaderRef = useRef(null);
	const [inodes, setInodes] = useState(folderData.inodes);
	const [lastSelectedInode, setSelectedInode] = useState(-1);
	const [favoriteFolders, setFavoriteFolders] = useState(folderData.favorite_folders);
	const [layout, setLayout] = useLayout('tiles');
	const [clipboard, setClipboard] = useClipboard();

	function selectInode(event: PointerEvent) {
		if (this.disabled)
			return;
		let modifier;
		if (event.detail === 2) {
			// double click
			if (folderData.is_trash)
				return;  // prevent editing files in trash folder
			window.location.assign(this.url);
		} else if ((event.detail as any)?.selected) {
			// this is a SelectableArea event
			modifier = f => ({...f, selected: f.selected || f.id === this.id});
		} else if (event.shiftKey) {
			// shift click
			const selectedInodeIndex = inodes.findIndex(f => f.id === this.id);
			if (selectedInodeIndex < lastSelectedInode) {
				modifier = (f, k) => ({...f, selected: k >= selectedInodeIndex && k <= lastSelectedInode});
			} else if (selectedInodeIndex > lastSelectedInode) {
				modifier = (f, k) => ({...f, selected: k >= lastSelectedInode && k <= selectedInodeIndex});
			}
		} else if (event.altKey || event.ctrlKey || event.metaKey) {
			// alt/ctrl/meta click
			if (this.selected) {
				modifier = f => ({...f, selected: f.selected && f.id !== this.id});
			} else {
				modifier = f => ({...f, selected: f.selected || f.id === this.id});
			}
		} else {
			// simple click
			if (this.selected) {
				modifier = f => ({...f, selected: false});
			} else {
				modifier = f => ({...f, selected: f.id === this.id});
			}
			if (!this.selected) {
				// remember the last selected inode for shift-click
				setSelectedInode(inodes.findIndex(inode => inode.id === this.id));
			}
		}
		setInodes(inodes.map((f, k) => ({...modifier(f, k), cutted: false, copied: false})));
	}

	async function refreshFolder() {
		const response = await fetch(folderData.fetch_inodes_url);
		if (response.status === 200) {
			const data = await response.json();
			setInodes(data.inodes);
		} else {
			console.error(response);
		}
	}

	function deselectAll(event) {
		setInodes(inodes.map(inode => ({...inode, selected: false})));
	}

	async function addFolder() {
		const folderName = window.prompt("Enter folder name");
		if (!folderName)
			return;
		const response = await fetch(folderData.add_folder_url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-CSRFToken': folderData.csrf_token,
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
		setClipboard(inodes.filter(inode => inode.selected).map(inode => ({...inode, selected: false, copied: true})));
		setInodes(inodes.map(inode => ({...inode, copied: inode.selected, selected: false})));
	}

	function cutInodes() {
		setClipboard(inodes.filter(inode => inode.selected).map(inode => ({...inode, selected: false, cutted: true})));
		setInodes(inodes.map(inode => ({...inode, cutted: inode.selected, selected: false})));
	}

	async function pasteInodes() {
		let fetchUrl;
		let pastedInodes = clipboard.filter(inode => inode.copied).map(inode => inode.id);
		if (pastedInodes.length) {
			fetchUrl = folderData.copy_inodes_url;
		} else {
			pastedInodes = clipboard.filter(inode => inode.cutted).map(inode => inode.id);
			if (pastedInodes.length) {
				fetchUrl = folderData.move_inodes_url;
			}
		}
		if (!fetchUrl)
			return;

		const response = await fetch(fetchUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-CSRFToken': folderData.csrf_token,
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
		const selectedInodes = inodes.filter(inode => inode.selected).map(inode => inode.id);
		const response = await fetch(folderData.delete_inodes_url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-CSRFToken': folderData.csrf_token,
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
		const response = await fetch(folderData.erase_trash_folder_url, {
			method: 'DELETE',
			headers: {
				'X-CSRFToken': folderData.csrf_token,
			},
		});
		if (response.status === 200) {
			const data = await response.json();
			window.location.assign(data.success_url);
		}
	}

	async function togglePin(pinnedId) {
		const response = await fetch(folderData.toggle_pin_url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-CSRFToken': folderData.csrf_token,
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

	const kwargs = {inodes, setInodes, selectInode, folderData, layout, setFavoriteFolders, deselectAll};
	return (<>
		<MenuBar
			clipboard={clipboard}
			parentUrl={folderData.parent_url}
			addFolder={addFolder}
			openUploader={() => uploaderRef.current.openUploader()}
			setLayout={switchLayout}
			copyInodes={copyInodes}
			cutInodes={cutInodes}
			pasteInodes={pasteInodes}
			deleteInodes={deleteInodes}
			eraseTrashFolder={eraseTrashFolder}
			isRoot={folderData.is_root}
			isTrash={folderData.is_trash}
			numSelected={inodes.filter(inode => inode.selected).length}
		/>
		<FolderTabs activeFolderId={folderData.id} folders={favoriteFolders} togglePin={togglePin} />
		<div className="work-area">
		{folderData.is_trash ? (
			<SelectableArea {...kwargs} />
		) : (

			<FileUploader ref={uploaderRef} folderData={folderData} refreshFolder={refreshFolder}>
				<SelectableArea {...kwargs} />
			</FileUploader>
		)}
		</div>
	</>);
}
