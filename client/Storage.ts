import {useEffect, useState} from 'react';


export const useClipboard = () => {
	const storageKey = 'filer-clipboard';
	const [value, setValue] = useState(
		JSON.parse(sessionStorage.getItem(storageKey)) ?? []
	);

	useEffect(() => {
		sessionStorage.setItem(storageKey, JSON.stringify(value));
	}, [value, storageKey]);

	return [value, setValue];
};


export const usePinnedFolders = () => {
	const storageKey = 'filer-pinned-folders';
	const [value, setValue] = useState(
		JSON.parse(localStorage.getItem(storageKey)) ?? []
	);

	useEffect(() => {
		localStorage.setItem(storageKey, JSON.stringify(value));
	}, [value, storageKey]);

	return [value, setValue];
};
