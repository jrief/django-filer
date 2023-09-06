import React, {useState, useRef} from 'react';
import {DragAndDropArea} from './DragAndDropArea';


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
	const {folderData, inodes, setInodes} = props;
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
			if (!folderData.is_trash) {
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
			console.log(rectangle);
			setActiveRect(rectangle);
			setClickHandler(window.setTimeout(() => {
				selectionDiscard();
				props.deselectAll();
				setClickHandler(null);
				console.log('selection discarded');
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
		function inside(x: number, y: number) : boolean {
			return (
				x >= activeRect.left && x <= activeRect.left + activeRect.width
				&& y >= activeRect.top && y <= activeRect.top + activeRect.height
			);
		}

		if (!activeRect)
			return;
		const areaRect = areaRef.current.getBoundingClientRect();
		activeRect.left += areaRect.x;
		activeRect.top += areaRect.y;
		console.log(activeRect);
		const elements = areaRef.current.querySelectorAll('.inode-list > li');
		for (let element of elements) {
			const elemRect = element.getBoundingClientRect();
			if (
				inside(elemRect.x, elemRect.y) || inside(elemRect.right, elemRect.y)
				|| inside(elemRect.x, elemRect.bottom) || inside(elemRect.right, elemRect.bottom)
			) {
				console.log(element);
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
		selectionDiscard();
	};

	function selectionDiscard() {
		setActiveRect(null);
	}

	function cssClasses() {
		const classes = ['selectable-area'];
		if (folderData.is_trash) {
			classes.push('trash');
		}
		return classes.join(' ');
	}

	const kwargs = {
		inodes, selectInode, folderData, setInodes,
		layout: props.layout,
		setFavoriteFolders: props.setFavoriteFolders
	};
	return (
		<div ref={areaRef} className={cssClasses()} onMouseDown={selectionStart} onMouseMove={selectionExtend} onMouseUp={selectionEnd} onMouseLeave={selectionDiscard}>
			<DragAndDropArea {...kwargs} />
			<SelectRectangle style={activeRect} />
		</div>
	)
}
