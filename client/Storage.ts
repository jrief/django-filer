import {useEffect, useState} from 'react';


function useSessionStorage(storageKey, initial) {
	return () => {
		const [value, setValue] = useState(
			JSON.parse(sessionStorage.getItem(storageKey)) ?? initial
		);

		useEffect(() => {
			sessionStorage.setItem(storageKey, JSON.stringify(value));
		}, [value, storageKey]);

		return [value, setValue];
	};
}

export const useClipboard = useSessionStorage('filer-clipboard', []);

export const useHistory = useSessionStorage('filer-history', {cursor: -1, hrefs: []});

export const useLayout = (initial: string) : [string, (value: string) => any] => {
	const key = 'django-filer-layout';
	const [value, setValue] = useState(
		document.cookie.split('; ').find(row => row.startsWith(`${key}=`))?.split('=')[1] ?? initial
	);

	function setCookie(value) {
		document.cookie = `${key}=${value}; path=/; expires=Fri, 31 Dec 9999 23:59:59 GMT; SameSite=Lax;`;
	}

	useEffect(() => {
		setCookie(value);
	}, [value, key]);

	return [
		value,
		value => {
			setCookie(value);
			setValue(value);
		},
	];
}
