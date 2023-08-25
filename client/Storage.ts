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


export const useLayout = (initial: string) => {
	const storageKey = 'filer-used-layout';
	const [value, setValue] = useState(
		JSON.parse(localStorage.getItem(storageKey)) ?? initial
	);

	useEffect(() => {
		localStorage.setItem(storageKey, JSON.stringify(value));
	}, [value, storageKey]);

	return [value, setValue];
};
