import {createRoot} from 'react-dom/client';
import React from 'react';
import {FolderSettings} from './FolderSettings';
import FilerAdmin from './FilerAdmin';


window.addEventListener('DOMContentLoaded', () => {
	const content = document.getElementById('content');
	const settings = JSON.parse(document.getElementById('folder-settings').textContent);
	settings.workAreaRect = content.getBoundingClientRect();
	createRoot(content).render(<FolderSettings.Provider value={settings}><FilerAdmin /></FolderSettings.Provider>);

	// prevent browser from loading a drag-and-dropped file
	window.addEventListener('dragover',function(event){
		event.preventDefault();
	},false);
	window.addEventListener('drop',function(event){
		event.preventDefault();
	},false);
});
