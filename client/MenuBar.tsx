import React, {useRef, useContext} from 'react';
import {useSorting} from './Storage';
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


export function MenuBar(props) {
	const settings = useContext(FolderSettings);
	const searchRef = useRef(null);
	const sortingRef = useRef(null);
	const [sorting, setSorting] = useSorting();

	function handleSearch(event) {
		if (searchRef.current.value.length > 2) {
			props.setSearchQuery(searchRef.current.value);
			//props.searchForInodes(searchRef.current.value);
		} else {
			props.setSearchQuery('');
		}
	}

	function resetSearch(event) {
		if (searchRef.current.value === '') {
			debugger;
		}
	}

	function handleInputEnter(event) {
		if (event.key === 'Enter') {
			handleSearch(event);
		}
		event.stopPropagation();
	}

	function confirmEraseTrashFolder() {
		if (window.confirm("Erase all files in the trash folder?")) {
			props.eraseTrashFolder();
		}
	}

	function changeSorting(value) {
		if (value !== sorting) {
			setSorting(value);
			props.refreshInodes();
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

	window.addEventListener('click', event => {
		if (!sortingRef.current?.parentElement?.contains(event.target)) {
			sortingRef.current.hidden = true;
		}
	});
	const searchParams = new URLSearchParams(window.location.search);

	return (
		<nav role="menubar">
			<ul>
				<li>
					<input ref={searchRef} type="search" defaultValue={searchParams.get('q') ?? ''} placeholder="Search for …" onEmptied={resetSearch} onKeyDown={handleInputEnter} />
					<span onClick={handleSearch}><SearchIcon /></span>
				</li>
				<li style={{marginLeft: 'auto'}} onClick={() => props.setLayout('tiles')}><TilesIcon /></li>
				<li onClick={() => props.setLayout('list')}><ListIcon /></li>
				<li style={{marginRight: 'auto'}} onClick={() => props.setLayout('columns')}><ColumnsIcon /></li>
				<li style={{marginRight: 'auto'}} onClick={() => sortingRef.current.hidden = !sortingRef.current.hidden} aria-haspopup="true">
					<SortingIcon />
					{renderSortingOptions()}
				</li>
				<li className={props.numSelected ? null : "disabled"} onClick={props.cutInodes} title="Cut"><CutIcon /></li>
				{settings.is_trash ? (
					<li className="erase" onClick={confirmEraseTrashFolder} title="Erase trash"><EraseIcon /></li>
				) : (<>
					<li className={props.numSelected ? null : "disabled"} onClick={props.copyInodes} title="Copy"><CopyIcon /></li>
					<li className={props.clipboard.length === 0 ? "disabled" : null} onClick={props.pasteInodes} title="Paste"><PasteIcon /></li>
					<li className={props.numSelected ? null : "disabled"} onClick={props.deleteInodes} title="Delete"><TrashIcon /></li>
					<li onClick={props.addFolder} title="Add folder"><AddFolderIcon /></li>
					<li className={props.numSelectedFiles ? null : "disabled"} onClick={props.downloadSelected} title="Download"><DownloadIcon /></li>
					<li onClick={props.openUploader} title="Upload"><UploadIcon /></li>
				</>)}
			</ul>
		</nav>
	);
}
