import React from 'react';
import {useDroppable} from '@dnd-kit/core';


export function XXXDroppable(props) {
	const {id, className, children, dragging} = props;
	const {
		isOver,
		setNodeRef,
	} = useDroppable({
		id: id,
	});

	function cssClasses() {
		const classes = [className];
		if (dragging) {
			classes.push('dragging');
		}
		if (isOver) {
			classes.push('drag-over');
		}
		return classes.join(' ');
	}

	return (
		<div ref={setNodeRef} className={cssClasses()}>
			{children}
		</div>
	);
}


export function DroppableArea(props) {
	const {id, className, children, dragging} = props;
	const {
		isOver,
		over,
		setNodeRef,
	} = useDroppable({
		id: id,
	});

	function cssClasses() {
		const classes = [className];
		if (dragging) {
			classes.push('dragging');
		}
		if (isOver && over.id !== props.currentId) {
			console.log('DroppableArea', id, props.currentId);
			classes.push('drag-over');
		}
		return classes.join(' ');
	}

	return (
		<div ref={setNodeRef} className={cssClasses()}>
			{children}
		</div>
	);
}
