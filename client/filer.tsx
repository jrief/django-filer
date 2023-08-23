import { createRoot } from 'react-dom/client';
import React from "react";
import FilerAdmin from './FilerAdmin';


window.addEventListener('DOMContentLoaded', () => {
	const content = createRoot(document.getElementById('content'));
	const folderData = JSON.parse(document.getElementById('folder-data').textContent);
	content.render(<FilerAdmin folderData={folderData} />);

	// prevent browser from loading a drag-and-dropped file
	window.addEventListener('dragover',function(event){
		event.preventDefault();
	},false);
	window.addEventListener('drop',function(event){
		event.preventDefault();
	},false);
});
