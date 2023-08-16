import React, {useState, useEffect} from 'react';
import BackIcon from './icons/back.svg';
import ForwardIcon from './icons/forward.svg';
import UpIcon from './icons/up.svg';
import ClockIcon from './icons/clock.svg';
import UploadIcon from './icons/upload.svg';


const useLocalStorage = (storageKey, initialState) => {
	const [value, setValue] = useState(
		JSON.parse(localStorage.getItem(storageKey)) ?? initialState
	);

	useEffect(() => {
		localStorage.setItem(storageKey, JSON.stringify(value));
	}, [value, storageKey]);

	return [value, setValue];
};

export function MenuBar(props) {
	function navigateBack() {
	}

	function navigateForward() {
	}

	function navigateUp() {
	}

	function showHistory() {
	}

	return (
		<nav role="menubar">
			<ul>
				<li onClick={navigateBack}><BackIcon /></li>
				<li onClick={navigateForward}><ForwardIcon /></li>
				<li className={props.parentUrl ? null : "disabled"}><a href={props.parentUrl}><UpIcon /></a></li>
				<li onClick={showHistory}><ClockIcon /></li>
				<li className="right" onClick={props.openUploader}><UploadIcon /></li>
			</ul>
		</nav>
	);
}
