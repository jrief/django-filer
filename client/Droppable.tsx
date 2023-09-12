import React from 'react';
import {useDroppable} from '@dnd-kit/core';


export function Droppable(props) {
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
			<div className="quadrant">{children}</div>
		</div>
	);
}
