import React, {forwardRef, useImperativeHandle, useState, useRef} from 'react';

export const FileUploader = forwardRef((props: any, ref) => {
	const folderData = props.folderData;
	const inputRef = useRef(null);
	const [dragging, setDragging] = useState(false);

	useImperativeHandle(ref, () => ({
		openUploader() {
			inputRef.current.click()
			console.log(ref);
		}
	}));

	function swallowEvent(event) {
		event.stopPropagation();
		event.preventDefault();
	}

	function handleDragEnter(event) {
		console.log('handleDragEnter');
		swallowEvent(event);
		setDragging(true);
	}

	function handleDrop(event) {
		swallowEvent(event);
		setDragging(false);
		if (event.dataTransfer) {
			inputRef.current.files = event.dataTransfer.files;
			uploadFiles();
		}
	}

	function uploadFiles() {
		const promises: Array<Promise<Response>> = [];
		for (let k = 0; k < inputRef.current.files.length; k++) {
			promises.push(uploadFile(inputRef.current.files.item(k)));
		}
		Promise.all(promises).then(() => {
			console.log('uploaded all files');
			props.refreshFolder();
		}).catch((error) => {
			console.log('uploadFiles.catch');
			console.log(error);
		});
	}

	function uploadFile(file) {
		return new Promise<Response>((resolve, reject) => {
			function transferComplete() {
				console.log('transferComplete');
				if (request.status === 200) {
					resolve(request.response);
				} else {
					reject(request.response);
				}
			}

			const request = new XMLHttpRequest();
			request.addEventListener('loadend', transferComplete);
			request.open('POST', folderData.upload_files_url, true);
			request.setRequestHeader('X-CSRFToken', folderData.csrf_token);
			request.responseType = 'json';
			const body = new FormData();
			body.append('upload_file', file);
			request.send(body);
		});
	}

	return (
		<div className="droppable-area" onDragEnter={handleDragEnter} onDragOver={swallowEvent} onDrop={handleDrop}>
			{props.children}
			<input type="file" name="file" multiple ref={inputRef} onChange={uploadFiles} />
		</div>
	)
});
