import React, {forwardRef, useContext, useEffect, useImperativeHandle, useRef, useState} from 'react';
import {InodeList} from './InodeList';
import {FolderSettings} from "./FolderSettings";


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


export const SelectableArea = (props) => {
	const settings = useContext(FolderSettings);
	const {folderId, clearClipboard, layout} = props;
	const areaRef = useRef(null);
	const [activeRect, setActiveRect] = useState(null);
	const [clickHandler, setClickHandler] = useState(null);

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
				// props.deselectAll();
				props.children;
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

	console.log('SelectableArea', folderId);

	return (
		<div ref={areaRef} className={cssClasses()} onMouseDown={selectionStart} onMouseMove={selectionExtend} onMouseUp={selectionEnd} onMouseLeave={selectionDiscard}>
			{props.children}
			<SelectRectangle style={activeRect} />
		</div>
	)
};
