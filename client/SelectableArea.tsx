import React, {useState, useRef} from 'react';
import {InodeList} from './InodeList';


function SelectRectangle(props) {
	if (!props.style)
		return;

	const style = {
		left: `${props.style.left}px`,
		top: `${props.style.top}px`,
		width: `${props.style.width}px`,
		height: `${props.style.height}px`,
	}
	return (
		<div className="select-rectangle" style={style}></div>
	);
}


export function SelectableArea(props) {
	const {settings, inodes, setInodes, folderId, clearClipboard} = props;
	const areaRef = useRef(null);
	const [lastSelectedInode, setSelectedInode] = useState(-1);
	const [activeRect, setActiveRect] = useState(null);
	const [clickHandler, setClickHandler] = useState(null);

	function selectInode(event: PointerEvent) {
		if (this.disabled)
			return;
		let modifier;
		if (event.detail === 2) {
			// double click
			if (!settings.is_trash) {
				// prevent editing files in trash folder
				window.location.assign(this.url);
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
		setInodes(
			folderId,
			inodes.map((f, k) => ({...modifier(f, k), cutted: false, copied: false})),
			inode => ({...inode, cutted: false, copied: false, selected: false}),
		);
		clearClipboard();
	}

	const selectionStart = (event) => {
		if (event.target === areaRef.current || event.target.parentElement === areaRef.current) {
			const areaRect = areaRef.current.getBoundingClientRect();
			const rectangle = {
				startX: event.clientX,
				startY: event.clientY,
				left: event.clientX - areaRect.x,
				top: event.clientY - areaRect.y,
				width: 1,
				height: 1,
			}
			setActiveRect(rectangle);
			setClickHandler(window.setTimeout(() => {
				selectionDiscard();
				props.deselectAll();
				setClickHandler(null);
			}, 250));
		} else {
			selectionDiscard();
		}
	};

	const selectionExtend = (event) => {
		if (!activeRect)
			return;
		window.clearTimeout(clickHandler);
		setClickHandler(null);
		const areaRect = areaRef.current.getBoundingClientRect();
		const nextRect = {
			...activeRect,
			width: event.clientX - activeRect.startX,
			height: event.clientY - activeRect.startY,
		};
		if (nextRect.width < 0) {
			nextRect.left = event.clientX - areaRect.x;
			nextRect.width = -nextRect.width;
		}
		if (nextRect.height < 0) {
			nextRect.top = event.clientY - areaRect.y;
			nextRect.height = -nextRect.height;
		}
		setActiveRect(nextRect);
	};

	const selectionEnd = () => {
		function overlaps(rect: DOMRect) : boolean {
			if (rect.x >= activeRect.left + activeRect.width || activeRect.left >= rect.right)
				return false;
			if (rect.y >= activeRect.top + activeRect.height || activeRect.top >= rect.bottom)
				return false;
			return true;
		}

		if (!activeRect)
			return;
		const areaRect = areaRef.current.getBoundingClientRect();
		activeRect.left += areaRect.x;
		activeRect.top += areaRect.y;
		const elements = areaRef.current.querySelectorAll('.inode-list > li');
		for (let element of elements) {
			const elemRect = element.getBoundingClientRect();
			if (overlaps(elemRect)) {
				setTimeout(() => {
					const event = new CustomEvent('click', {
						bubbles: true,
						cancelable: false,
						detail: {selected: true},
					});
					element.dispatchEvent(event);
				}, 0);
			}
		}
		if (elements.length) {
			clearClipboard();
		}
		selectionDiscard();
	};

	function selectionDiscard() {
		setActiveRect(null);
	}

	function cssClasses() {
		const classes = ['selectable-area'];
		if (settings.is_trash) {
			classes.push('trash');
		}
		return classes.join(' ');
	}

	return (
		<div ref={areaRef} className={cssClasses()} onMouseDown={selectionStart} onMouseMove={selectionExtend} onMouseUp={selectionEnd} onMouseLeave={selectionDiscard}>
			<InodeList {...props} selectInode={selectInode} />
			<SelectRectangle style={activeRect} />
		</div>
	)
}
