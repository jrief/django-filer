import React from 'react';
import {useDroppable} from '@dnd-kit/core';
import {Folder, File, Inode, ListItem} from './Inode';


export function InodeList(props) {
	const {inodes, dragOverlay, setInodes, layout, settings} = props;
	const {
		isOver,
		active,
		setNodeRef,
	} = useDroppable({
		id: `depth:${props.depth}`,
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
			}).then(props.handleResponse);
		}
		if (inodes.findIndex(inode => inode.id === newInode.id && inode.name !== newInode.name) !== -1) {
			setInodes(props.depth, inodes.map(inode => inode.id === newInode.id ? {...newInode, dirty: true} : inode));
		}
	}

	if (dragOverlay) {
		return (
			<ul className="inode-list">
				{inodes.filter(f => f.dragged).map(inode =>
				(<Inode key={inode.id} {...inode}>
					<div className="inode">
						<ListItem {...inode} layout={layout} />
					</div>
				</Inode>))}
			</ul>
		);
	}

	return (
		<ul ref={setNodeRef} className={`inode-list${isOver ? ' is-over': ''}`}>
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
			{inodes.map(inode => (inode.is_folder
			? <Folder key={inode.id} {...inode} {...props} changeInode={changeInode} />
			: <File key={inode.id} {...inode} {...props} changeInode={changeInode} />
			))}
		</ul>
	)
}
