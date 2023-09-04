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


export const useLayout = (initial: string) : [string, (value: string) => any] => {
	const key = 'django-filer-layout';
	const [value, setValue] = useState(
		document.cookie.split('; ').find(row => row.startsWith(`${key}=`))?.split('=')[1] ?? initial
	);

	useEffect(() => {
		document.cookie = `${key}=${value}; path=/; expires=Fri, 31 Dec 9999 23:59:59 GMT; SameSite=Lax;`;
	}, [value, key]);

	return [value, setValue];
}
