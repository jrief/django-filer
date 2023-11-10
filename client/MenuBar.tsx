import React, {useRef, useContext, forwardRef, useState, useImperativeHandle} from 'react';
import {useClipboard, useSorting} from './Storage';
import {useSearchParam} from './Search';
import {FolderSettings} from "./FolderSettings";
import SearchIcon from './icons/search.svg';
import CopyIcon from './icons/copy.svg';
import TilesIcon from './icons/tiles.svg';
import ListIcon from './icons/list.svg';
import ColumnsIcon from './icons/columns.svg';
import SortingIcon from './icons/sorting.svg';
import SortAscIcon from './icons/sort-asc.svg';
import SortDescIcon from './icons/sort-desc.svg';
import CutIcon from './icons/cut.svg';
import PasteIcon from './icons/paste.svg';
import TrashIcon from './icons/trash.svg';
import EraseIcon from './icons/erase.svg';
import AddFolderIcon from './icons/add-folder.svg';
import DownloadIcon from './icons/download.svg';
import UploadIcon from './icons/upload.svg';


export const MenuBar = forwardRef((props: any, ref) => {
	const settings = useContext(FolderSettings);
	const {currentFolderId, inodesRefs, folderTabsRef, openUploader, downloadFiles, setLayout, setSearchResult} = props;
	const searchRef = useRef(null);
	const sortingRef = useRef(null);
	const [numSelectedInodes, setNumSelectedInodes] = useState(0);
	const [numSelectedFiles, setNumSelectedFiles] = useState(0);
	const [searchQuery, setSearchQuery] = useSearchParam('q');
	const [sorting, setSorting] = useSorting();
	const [clipboard, setClipboard] = useClipboard();

	useImperativeHandle(ref, () => ({
		setSelected: selectedInodes => {
			setNumSelectedInodes(selectedInodes.length);
			setNumSelectedFiles(selectedInodes.filter(inode => !inode.is_folder).length);
		},
	}));

	window.addEventListener('keydown', event => {
		if (event.key === 'c' && (event.ctrlKey || event.metaKey || event.altKey)) {
			copyInodes();
		} else if (event.key === 'x' && (event.ctrlKey || event.metaKey || event.altKey)) {
			cutInodes();
		} else if (event.key === 'v' && (event.ctrlKey || event.metaKey || event.altKey)) {
			pasteInodes();
		} else if (['Backspace', 'Delete'].includes(event.key)) {
			deleteInodes();
		}
	});

	window.addEventListener('click', event => {
		if (!sortingRef.current?.parentElement?.contains(event.target)) {
			sortingRef.current.hidden = true;
		}
	});

	function handleSearch(event) {
		const performSearch = () => {
			setSearchQuery(searchRef.current.value);
			const current = inodesRefs[settings.folder_id].current;
			current.setSearchQuery(searchRef.current.value);
			setSearchResult(true);
		};
		const resetSearch = () => {
			setSearchQuery('');
			Object.entries(inodesRefs as React.MutableRefObject<any>).forEach(([folderId, inodeRef]) => {
				inodeRef.current?.setSearchQuery();
			});
			setSearchResult(false);
		};

		if (event.type === 'change' && searchRef.current.value.length === 0) {
			// clicked on the X button
			resetSearch();
		} else if (event.type === 'keydown' && event.key === 'Enter') {
			// pressed Enter
			searchRef.current.value.length === 0 ? resetSearch() : performSearch();
		} else if (event.type === 'click' && searchRef.current.value.length > 2) {
			// clicked on the search button
			performSearch();
		}
	}

	function confirmEraseTrashFolder() {
		if (window.confirm("Erase all files in the trash folder?")) {
			eraseTrashFolder();
		}
	}

	function changeSorting(value) {
		if (value !== sorting) {
			setSorting(value);
			Object.entries(inodesRefs as React.MutableRefObject<any>).forEach(([folderId, inodeRef]) => {
				inodeRef.current?.fetchInodes();
			});
		}
	}

	function renderSortingOptions() {
		const isActive = (value) => sorting === value ? 'active' : null;

		return (
			<ul ref={sortingRef} className="sorting-options" hidden>
				<li onClick={() => changeSorting('')} className={isActive('')}><span>Unsorted</span></li>
				<li onClick={() => changeSorting('name_asc')} className={isActive('name_asc')}><SortDescIcon /><span>Name</span></li>
				<li onClick={() => changeSorting('name_desc')} className={isActive('name_desc')}><SortAscIcon /><span>Name</span></li>
				<li onClick={() => changeSorting('date_asc')} className={isActive('date_asc')}><SortDescIcon /><span>Date</span></li>
				<li onClick={() => changeSorting('date_desc')} className={isActive('date_desc')}><SortAscIcon /><span>Date</span></li>
				<li onClick={() => changeSorting('size_asc')} className={isActive('size_asc')}><SortDescIcon /><span>Size</span></li>
				<li onClick={() => changeSorting('size_desc')} className={isActive('size_desc')}><SortAscIcon /><span>Size</span></li>
				<li onClick={() => changeSorting('type_asc')} className={isActive('type_asc')}><SortDescIcon /><span>Type</span></li>
				<li onClick={() => changeSorting('type_desc')} className={isActive('type_desc')}><SortAscIcon /><span>Type</span></li>
			</ul>
		)
	}

	function clearClipboard() {
		setClipboard([]);
	}

	function copyInodes() {
		const current = inodesRefs[currentFolderId].current;
		setClipboard(current.inodes.filter(inode => inode.selected).map(inode => ({...inode, selected: false, copied: true})));
		current.setInodes(current.inodes.map(inode => ({...inode, selected: false, copied: inode.selected})));
		setNumSelectedInodes(0);
		setNumSelectedFiles(0);
	}

	function cutInodes() {
		const current = inodesRefs[currentFolderId].current;
		setClipboard(current.inodes.filter(inode => inode.selected).map(inode => ({...inode, selected: false, cutted: true})));
		current.setInodes(current.inodes.map(inode => ({...inode, selected: false, cutted: inode.selected})));
		setNumSelectedInodes(0);
		setNumSelectedFiles(0);
	}

	async function pasteInodes() {
		let moveInodes = false;
		let inodeIds = clipboard.filter(inode => inode.copied).map(inode => inode.id);
		if (inodeIds.length === 0) {
			inodeIds = clipboard.filter(inode => inode.cutted).map(inode => inode.id);
			if (inodeIds.length === 0)
				return;
			moveInodes = true;
		}
		if (inodeIds.length === 0 || clipboard[0].folderId === currentFolderId)
			return;

		const fetchUrl = `${settings.base_url}${settings.folder_id}/${moveInodes ? 'move' : 'copy'}`;
		const response = await fetch(fetchUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-CSRFToken': settings.csrf_token,
			},
			body: JSON.stringify({inode_ids: inodeIds}),
		});
		if (response.ok) {
			const body = await response.json();
			if (moveInodes) {
				const current = inodesRefs[clipboard[0].parent]?.current;
				if (current) {
					current.setInodes(current.inodes.filter(inode => inodeIds.find(id => id !== inode.id)));
				}
			}
			inodesRefs[settings.folder_id].current.setInodes(body.inodes);
			clearClipboard();
		} else if (response.status === 409) {
			alert(await response.text());
		} else {
			console.error(response);
		}
	}

	async function deleteInodes() {
		const current = inodesRefs[currentFolderId].current;
		const inodeIds = current.inodes.filter(inode => inode.selected).map(inode => inode.id);
		if (inodeIds.length === 0)
			return;

		let fetchUrl = `${settings.base_url}${settings.folder_id}/delete`;
		const response = await fetch(fetchUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-CSRFToken': settings.csrf_token,
			},
			body: JSON.stringify({inode_ids: inodeIds}),
		});
		if (response.ok) {
			const body = await response.json();
			folderTabsRef.current.setFavoriteFolders(body.favorite_folders);
			const inodes = current.inodes.filter(inode => inodeIds.find(id => id !== inode.id))
			current.setInodes(inodes);
		} else {
			console.error(response);
		}
	}

	async function addFolder() {
		const folderName = window.prompt("Enter folder name");
		if (!folderName)
			return;
		const addFolderUrl = `${settings.base_url}${settings.folder_id}/add_folder`;
		const response = await fetch(addFolderUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-CSRFToken': settings.csrf_token,
			},
			body: JSON.stringify({
				name: folderName,
			}),
		});
		if (response.ok) {
			const current = inodesRefs[settings.folder_id].current;
			const body = await response.json();
			current.setInodes([...current.inodes, body.new_folder]);  // adds new folder to the end of the list
		} else if (response.status === 409) {
			alert(await response.text());
		} else {
			console.error(response);
		}
	}

	function downloadSelectedFiles() {
		const current = inodesRefs[currentFolderId].current;
		downloadFiles(current.inodes.filter(inode => !inode.is_folder && inode.selected));
		current.deselectinodes();
	}

	async function eraseTrashFolder() {
		const fetchUrl = `${settings.base_url}erase_trash_folder`;
		const response = await fetch(fetchUrl, {
			method: 'DELETE',
			headers: {
				'X-CSRFToken': settings.csrf_token,
			},
		});
		if (response.status === 200) {
			clearClipboard();
			const data = await response.json();
			window.location.assign(data.success_url);
		}
	}

	console.log('MenuBar', numSelectedInodes, numSelectedFiles);

	return (
		<nav role="menubar">
			<ul>
				<li>
					<input ref={searchRef} type="search" defaultValue={searchQuery} placeholder="Search for …" onChange={handleSearch} onKeyDown={handleSearch} />
					<span onClick={handleSearch}><SearchIcon /></span>
				</li>
				<li style={{marginLeft: 'auto'}} onClick={() => setLayout('tiles')}><TilesIcon /></li>
				<li onClick={() => setLayout('list')}><ListIcon /></li>
				<li style={{marginRight: 'auto'}} onClick={() => setLayout('columns')}><ColumnsIcon /></li>
				<li style={{marginRight: 'auto'}} onClick={() => sortingRef.current.hidden = !sortingRef.current.hidden} aria-haspopup="true">
					<SortingIcon />
					{renderSortingOptions()}
				</li>
				<li className={numSelectedInodes ? null : "disabled"} onClick={cutInodes} title="Cut"><CutIcon /></li>
				{settings.is_trash ? (
					<li className="erase" onClick={confirmEraseTrashFolder} title="Erase trash"><EraseIcon /></li>
				) : (<>
					<li className={numSelectedInodes ? null : "disabled"} onClick={copyInodes} title="Copy"><CopyIcon /></li>
					<li className={clipboard.length === 0 ? "disabled" : null} onClick={pasteInodes} title="Paste"><PasteIcon /></li>
					<li className={numSelectedInodes ? null : "disabled"} onClick={deleteInodes} title="Delete"><TrashIcon /></li>
					<li onClick={addFolder} title="Add folder"><AddFolderIcon /></li>
					<li className={numSelectedFiles ? null : "disabled"} onClick={downloadSelectedFiles} title="Download"><DownloadIcon /></li>
					<li onClick={openUploader} title="Upload"><UploadIcon /></li>
				</>)}
			</ul>
		</nav>
	);
});
