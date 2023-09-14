import React from 'react';
import {useDroppable} from '@dnd-kit/core';
import {Folder, File, Inode, ListItem} from './Inode';


export function InodeList(props) {
	const {inodes, folderId, setInodes, layout, settings} = props;
	const {
		isOver,
		over,
		setNodeRef,
	} = useDroppable({
		id: `column:${folderId}`,
	});

	function changeInode(newInode, persist?: boolean) {
		if (persist && newInode.dirty) {
			fetch(settings.update_inode_url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-CSRFToken': settings.csrf_token,
				},
				body: JSON.stringify(newInode),
			}).then(async response => {
				if (response.ok) {
					const body = await response.json();
					setInodes(folderId, inodes.map(inode => inode.id === body['new_inode'].id ? body['new_inode'] : inode));
				}
			});
		}
		if (inodes.findIndex(inode => inode.id === newInode.id && inode.name !== newInode.name) !== -1) {
			setInodes(folderId, inodes.map(inode => inode.id === newInode.id ? {...newInode, dirty: true} : inode));
		}
	}

	function cssClasses() {
		const classes = ['inode-list'];
		if (isOver && over.id !== `column:${props.currentFolderId}`) {
			classes.push('drag-over');
		}
		return classes.join(' ');
	}

	return (
		<ul ref={setNodeRef} className={cssClasses()}>
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
			? <Folder key={inode.id} {...inode} {...props} changeInode={changeInode} isParent={props.previousFolder === inode.id} />
			: <File key={inode.id} {...inode} {...props} changeInode={changeInode} />
			)}
		</ul>
	)
}


export function DraggedInodes(props) {
	const {inodes, layout} = props;

	return (
		<ul className="inode-list">{
			inodes.filter(f => f.dragged).map(inode =>
			<Inode key={inode.id} {...inode}>
				<div className="inode">
					<ListItem {...inode} layout={layout} />
				</div>
			</Inode>)
		}</ul>
	);
}
