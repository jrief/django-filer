import { createRoot } from 'react-dom/client';
import React from "react";
import FilerAdmin from './FilerAdmin';


window.addEventListener('DOMContentLoaded', () => {
	const content = createRoot(document.getElementById('content'));
	const folderData = JSON.parse(document.getElementById('folder-data').textContent);
	content.render(<FilerAdmin folderData={folderData} />);
});