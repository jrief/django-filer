import {useDroppable} from '@dnd-kit/core';
import DownloadIcon from './icons/download.svg';
import TrashIcon from './icons/trash.svg';


export function AlternativeDroppable(props) {
	const {id, className, children} = props;
	const {
		isOver,
		setNodeRef,
	} = useDroppable({
		id: id,
	});

	function cssClasses() {
		const classes = [className];
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
