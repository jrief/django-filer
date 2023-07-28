import {useState} from 'react';
import {DndContext} from '@dnd-kit/core';
import {arrayMove, SortableContext} from '@dnd-kit/sortable';
import {Droppable} from './Droppable';
import {Draggable} from './Draggable';
import {SortableItem} from "./SortableItem";


export default function FolderAdmin() {
	const [languages, setLanguages] = useState(['JavaScript', 'Python', 'TypeScript']);

	return (
		<DndContext onDragEnd={handleDragEnd}>
			<SortableContext items={languages}>
			{languages.map(language => <SortableItem key={language} id={language}/>)}
			</SortableContext>
		</DndContext>
	);

	function handleDragEnd(event) {
		const {active, over} = event;
		if (active.id !== over.id) {
			setLanguages(items => {
				const activeIndex = items.indexOf(active.id);
				const overIndex = items.indexOf(over.id);
				return arrayMove(items, activeIndex, overIndex);
			});
		}
	}
}
