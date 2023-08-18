import React, {forwardRef, useEffect, useImperativeHandle, useState, useRef} from 'react';


function DragOverlay(props) {
	if (props.dragging)
		return (
			<div className="progress-overlay">
				<div className="progress-indicator">
					<p>Drop files here</p>
				</div>
			</div>
		);
}


function ProgressOverlay(props) {
	useEffect(() => {
		console.log('ProgressOverlay.useEffect');
		console.log(props.uploading);
	}, [props.uploading]);

	return (
		<div className="progress-overlay">
			<div className="progress-indicator">
				<p>Uploading:</p>
				<ul className="progress-bar">{uploading.map((file, index) => (
					<li key={index}>
						{file.name}
						<progress value={file.complete} max="1"></progress>
					</li>
				))}</ul>
			</div>
		</div>
	);
}


export const FileUploader = forwardRef((props: any, ref) => {
	const folderData = props.folderData;
	const inputRef = useRef(null);
	const [dragging, setDragging] = useState(false);
	const [uploading, setUploading] = useState([]);

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

	function handleDragLeave(event) {
		console.log('handleDragLeave');
		swallowEvent(event);
		setDragging(false);
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
			setUploading([]);
			props.refreshFolder();
		}).catch((error) => {
			console.log('uploadFiles.catch');
			console.log(error);
			setUploading([]);
		});
	}

	function uploadFile(file) {
		return new Promise<Response>((resolve, reject) => {
			function transferStart() {
				file.complete = 0;
				console.log(file);
			}

			function transferProgress(event: ProgressEvent) {
				file.complete = event.lengthComputable ? event.loaded / event.total : 0;
				console.log(file);
			}

			function transferComplete() {
				console.log('transferComplete');
				if (request.status === 200) {
					resolve(request.response);
				} else {
					reject(request.response);
				}
			}

			// file.transferComplete = transferComplete;
			setUploading([...uploading, file]);
			const request = new XMLHttpRequest();
			request.addEventListener('loadstart', transferStart);
			request.upload.addEventListener('progress', transferProgress, false);
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
		<div className="droppable-area" onDragEnter={handleDragEnter} onDragOver={swallowEvent} onMouseLeave={handleDragLeave} onDrop={handleDrop}>
			{props.children}
			<input type="file" name="file" multiple ref={inputRef} onChange={uploadFiles} />
			<DragOverlay dragging={dragging} />
		</div>
	)
});
