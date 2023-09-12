import React, {useState} from 'react';
import {useDraggable, useDroppable} from '@dnd-kit/core';


export function Inode(props) {
	const {
		attributes,
		listeners,
		setNodeRef,
	} = useDraggable({
		id: props.id,
		data: props,
		disabled: props.disabled,
	});
	const [clickHandler, setClickHandler] = useState(null);

	function cssClasses() {
		let classes = [];
		if (props.disabled) {
			classes.push('disabled');
		} else if (props.selected) {
			classes.push('selected');
		} else if (props.copied) {
			classes.push('copied');
		} else if (props.cutted) {
			classes.push('cutted');
		}
		if (props.dragged) {
			classes.push('dragging');
		}
		return classes.join(' ');
	}

	function activateInode(event) {
		console.log(event);
		if (event.detail === 1) {
			setClickHandler(window.setTimeout(() => {
				console.log(event.detail);
				props.selectInode.bind(props)(event);
				setClickHandler(null);
			}, 250));
		} else if (event.detail === 2) {
			if (clickHandler) {
				window.clearTimeout(clickHandler);
				setClickHandler(null);
			}
			props.selectInode.bind(props)(event);
		} else if (event.detail.selected) {
			console.log(event.detail);
			props.selectInode.bind(props)(event);
		}
		event.stopPropagation();
		event.preventDefault();
	}

	if (props.selectInode)
		return (
			<li ref={setNodeRef} data-id={props.id} className={cssClasses()} onClick={activateInode} {...listeners} {...attributes}>
				{props.children}
			</li>
		);
	else
		return (
			<li data-id={props.id}>
				{props.children}
			</li>
		);
}


export function ListItem(props) {
	const [focusHandler, setFocusHandler] = useState(null);

	function swallowEvent(event) {
		event.stopPropagation();
		event.preventDefault();
	}

	function handleFocus(event) {
		// enforce two slow clicks to focus the textarea
		if (!(event.target instanceof HTMLTextAreaElement))
			return;
		if (!focusHandler) {
			event.target.blur();
		}
		setFocusHandler(window.setTimeout(() => {
			if (focusHandler) {
				window.clearTimeout(focusHandler);
			}
			setFocusHandler(null);
		}, 2000));
	}

	function changeName(event) {
		if (event.target.value !== props.name) {
			props.changeInode({...props, name: event.target.value});
		} else if (event.type === 'blur') {
			console.log(props);
			props.changeInode(props, true);
		}
	}

	switch (props.layout) {
		case 'tiles':
			return (
				<figure>
					<img src={props.thumbnail_url} />
					<figcaption>
						{!props.settings || props.settings.is_trash ? (
						<span>{props.name}</span>
						) : (
						<textarea name={`inode-${props.id}`} value={props.name} onClick={swallowEvent} onFocus={handleFocus} onChange={changeName} onBlur={changeName}></textarea>
						)}
					</figcaption>
				</figure>
			);
		case 'list':
			return (<>
				<div>
					<img src={props.thumbnail_url} />
				</div>
				<div>
				{!props.settings || props.settings.is_trash ? (
					props.name
				) : (
					<textarea name={`inode-${props.id}`} value={props.name} onClick={swallowEvent} onChange={changeName} onFocus={handleFocus} onBlur={changeName}></textarea>
				)}
				</div>
				<div>
					{props.owner_name}
				</div>
				<div>
					{props.details}
				</div>
				<div>{props.created_at}</div>
				<div>{props.mime_type}</div>
			</>);
		case 'columns':
			return (<>
				<div>
					<img src={props.thumbnail_url} />
				</div>
				<div>
				{!props.settings || props.settings.is_trash ? (
					props.name
				) : (
					<textarea name={`inode-${props.id}`} value={props.name} onClick={swallowEvent} onChange={changeName} onFocus={handleFocus} onBlur={changeName}></textarea>
				)}
				</div>
			</>);
	}
}


export function File(props) {
	return (
		<Inode {...props}>
			<div className="inode">
				<ListItem {...props} />
			</div>
		</Inode>
	);
}

export function Folder(props) {
	const {
		isOver,
		active,
		setNodeRef,
	} = useDroppable({
		id: `folder:${props.id}`,
		disabled: props.disabled,
	});

	function cssClasses() {
		const classes = ['inode'];
		if (props.isParent) {
			classes.push('parent');
		}
		if (isOver && active.id !== props.id) {
			classes.push('drag-over');
		}
		if (props.disabled) {
			classes.push('disabled');
		}
		return classes.join(' ');
	}

	return (
		<Inode {...props}>
			<div ref={setNodeRef} className={cssClasses()}>
				<ListItem {...props} />
			</div>
		</Inode>
	);
}
