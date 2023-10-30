import React, {
	forwardRef,
	SyntheticEvent,
	useContext,
	useEffect,
	useImperativeHandle,
	useState,
} from 'react';
import {Folder, File, Inode, ListItem} from './Inode';
import {FolderSettings} from './FolderSettings';


export const InodeList = forwardRef((props: any, ref) => {
	const settings = useContext(FolderSettings);
	const {folderId, setCurrentFolder, layout} = props;
	const [inodes, setInodes] = useState([]);
	const [lastSelectedInode, setSelectedInode] = useState(-1);

	useEffect(() => {
		fetchInodes();
	}, []);

	useImperativeHandle(ref, () => ({
		inodes: inodes,
		setInodes: inodes => {
			console.log('setInodes');
			setInodes(inodes);
		},
		deselectInodes: () => {
			console.log('deselectInodes');
			deselectInodes();
		},
		async fetchInodes() {
			await fetchInodes();
		},
		async addFolder() {
			await addFolder();
		},
	}));

	async function fetchInodes() {
		const fetchInodesUrl = `${settings.base_url}${folderId}/fetch`;
		const response = await fetch(fetchInodesUrl);
		if (response.ok) {
			const body = await response.json();
			setInodes(body.inodes);
		} else {
			console.error(response);
			return;
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
			const body = await response.json();
			setInodes([...inodes, body.new_folder]);
		} else {
			console.error(response);
			return;
		}
	}

	function selectInode(event: PointerEvent) {
		if (this.disabled)
			return;
		setCurrentFolder(folderId);
		let modifier;
		if (event.detail === 2) {
			// double click
			if (!settings.is_trash) {
				// prevent editing files in trash folder
				window.location.assign(this.change_url);
			}
			return;
		} else if ((event.detail as any)?.selected) {
			// this is a SelectableArea event
			modifier = f => ({...f, selected: f.selected || f.id === this.id});
		} else if (event.shiftKey) {
			// shift click
			const selectedInodeIndex = inodes.findIndex(f => f.id === this.id);
			if (selectedInodeIndex < lastSelectedInode) {
				modifier = (f, k) => ({...f, selected: k >= selectedInodeIndex && k <= lastSelectedInode});
			} else if (lastSelectedInode !== -1 && selectedInodeIndex > lastSelectedInode) {
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
		//clearClipboard();
	}

	function deselectInodes() {
		if (inodes.find(inode => inode.selected)) {
			setInodes(inodes.map(inode => ({...inode, selected: false})));
		}
	}

	function changeInode(newInode, persist?: boolean) {
		const updateInodeUrl = `${settings.base_url}/${folderId}/update`;
		if (persist && newInode.dirty) {
			fetch(updateInodeUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-CSRFToken': settings.csrf_token,
				},
				body: JSON.stringify(newInode),
			}).then(async response => {
				if (response.ok) {
					const body = await response.json();
					setInodes(inodes.map(inode => inode.id === body['new_inode'].id ? body['new_inode'] : inode));
				}
			});
		}
		if (inodes.findIndex(inode => inode.id === newInode.id && inode.name !== newInode.name) !== -1) {
			setInodes(inodes.map(inode => inode.id === newInode.id ? {...newInode, dirty: true} : inode));
		}
	}

	const deactivateInodes = (event: SyntheticEvent) => {
		if (event.target instanceof Element && event.target.classList.contains('inode-list')) {
			deselectInodes();
		}
	};

	// function cssClasses() {
	// 	const classes = ['inode-list'];
	// 	if (isOver && over.id !== `column:${props.currentFolderId}`) {
	// 		classes.push('drag-over');
	// 	}
	// 	return classes.join(' ');
	// }

	console.log('InodeList', folderId, inodes);

	return (
		<ul className="inode-list" onClick={deactivateInodes}>
			{layout === 'list' ? (
			<li className="header">
				<div className="inode">
					<div></div>
					<div>Name</div>
					<div>Owner</div>
					<div>Details</div>
					<div>Created at</div>
					<div>Mime type</div>
				</div>
			</li>
			) : null}
			{inodes.map(inode => inode.is_folder
			? <Folder key={inode.id} {...inode} {...props} selectInode={selectInode} changeInode={changeInode} isParent={props.previousFolder === inode.id} />
			: <File key={inode.id} {...inode} {...props} selectInode={selectInode} changeInode={changeInode} />
			)}
		</ul>
	)
});


export function DraggedInodes(props) {
	const {inodes, layout} = props;

	return (
		<ul className="inode-list">{
			inodes.map(inode =>
			<Inode key={inode.id} {...inode}>
				<div className="inode">
					<ListItem {...inode} layout={layout} />
				</div>
			</Inode>)
		}</ul>
	);
}
