import React from 'react';
import BackIcon from './icons/back.svg';
import ForwardIcon from './icons/forward.svg';
import UpIcon from './icons/up.svg';
import ClockIcon from './icons/clock.svg';
import PinIcon from './icons/pin.svg';
import UnpinIcon from './icons/unpin.svg';
import CopyIcon from './icons/copy.svg';
import CutIcon from './icons/cut.svg';
import PasteIcon from './icons/paste.svg';
import TrashIcon from './icons/trash-empty.svg';
import EraseIcon from './icons/erase.svg';
import AddFolderIcon from './icons/add-folder.svg';
import UploadIcon from './icons/upload.svg';


export function MenuBar(props) {
	function navigateBack() {
	}

	function navigateForward() {
	}

	function showHistory() {
	}

	return (
		<nav role="menubar">
			<ul>
				<li onClick={navigateBack}><BackIcon /></li>
				<li onClick={navigateForward}><ForwardIcon /></li>
				<li className={props.parentUrl ? null : "disabled"}><a href={props.parentUrl}><UpIcon /></a></li>
				<li onClick={showHistory}><ClockIcon /></li>
				<li className={props.isRoot || props.isTrash ? "disabled" : null} onClick={props.togglePin} style={{marginRight: 'auto'}}>{
					props.isPinned ? <UnpinIcon /> : <PinIcon />
				}</li>
				<li className={props.numSelected ? null : "disabled"} onClick={props.cutInodes} title="Cut"><CutIcon /></li>
				{props.isTrash ? (
					<li onClick={props.eraseTrashFolder} title="Erase trash"><EraseIcon /></li>
				) : (<>
					<li className={props.numSelected ? null : "disabled"} onClick={props.copyInodes} title="Copy"><CopyIcon /></li>
					<li className={props.clipboard.length === 0 ? "disabled" : null} onClick={props.pasteInodes} title="Paste"><PasteIcon /></li>
					<li className={props.numSelected ? null : "disabled"} onClick={props.deleteInodes} title="Delete"><TrashIcon /></li>
					<li onClick={props.addFolder} title="Add folder"><AddFolderIcon /></li>
					<li onClick={props.openUploader} title="Upload"><UploadIcon /></li>
				</>)}
			</ul>
		</nav>
	);
}
