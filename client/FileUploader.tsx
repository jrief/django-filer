import React, {forwardRef, useEffect, useImperativeHandle, useState, useRef} from 'react';


function ProgressOverlay(props) {
	return (
		<div className="progress-overlay">
			<div className="progress-indicator">{
			props.dragging ? (
				<p>Drop files here</p>
			) : (<>
				<p>Uploading:</p>
				<ul className="progress-bar">
				{props.children}
				</ul>
			</>)
			}</div>
		</div>
	);
}


function ProgressBar(props) {
	const {file, uploadUrl, CSRFToken} = props;
	const [complete, setComplete] = useState(0);

	useEffect(() => {
		const request = new XMLHttpRequest();
		request.addEventListener('loadstart', transferStart);
		request.upload.addEventListener('progress', transferProgress, false);
		request.addEventListener('loadend', transferComplete);
		request.open('POST', uploadUrl, true);
		request.setRequestHeader('X-CSRFToken', CSRFToken);
		request.responseType = 'json';
		const body = new FormData();
		body.append('upload_file', file);
		request.send(body);

		return () => {
			request.removeEventListener('loadstart', transferStart);
			request.removeEventListener('progress', transferProgress);
			request.removeEventListener('loadend', transferComplete);
		};
	}, [file]);

	function transferStart(xxx) {
		console.log('transferStart');
		console.log(file);
	}

	function transferProgress(event: ProgressEvent) {
		if (event.lengthComputable) {
			setComplete(event.loaded / event.total);
		}
	}

	function transferComplete(event: ProgressEvent) {
		console.log('transferComplete');
		console.log(file);
		if (event.lengthComputable) {
			setComplete(event.loaded / event.total);
		}
		const request = event.target as XMLHttpRequest;
		if (request.status === 200) {
			file.resolve(request.response);
		} else {
			file.reject(request.response);
		}
	}

	return (
		<li>
			{file.name}
			<progress value={complete} max="1"></progress>
		</li>
	);
}


export const FileUploader = forwardRef((props: any, ref) => {
	const {settings} = props;
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
			uploadFiles(event.dataTransfer.files);
		}
	}

	function handleFileSelect(event) {
		console.log('handleFileSelect');
		console.log(event);
		uploadFiles(event.target.files);
	}

	function uploadFiles(files: FileList) {
		const promises: Array<Promise<Response>> = [];
		for (let k = 0; k < files.length; k++) {
			promises.push(uploadFile(files.item(k)));
		}
		setUploading([...uploading, ...files]);
		Promise.all(promises).then(() => {
			console.log('uploaded all files');
		}).catch((error) => {
			alert(error);
		}).finally(() => {
			setUploading([]);
			props.refreshFolder();
		});
	}

	function uploadFile(file) {
		return new Promise<Response>((resolve, reject) => {
			file.resolve = resolve;
			file.reject = reject;
		});
	}

	return (
		<div className="file-uploader" onDragEnter={handleDragEnter} onDragOver={swallowEvent} onMouseLeave={handleDragLeave} onDrop={handleDrop}>
			{props.children}
			<input type="file" name="file" multiple ref={inputRef} onChange={handleFileSelect} />
			{dragging || uploading.length > 0 ? (
			<ProgressOverlay dragging={dragging}>
				{uploading.map((file, index) => (
					<ProgressBar key={index} file={file} />
				))}
			</ProgressOverlay>
			) : null}
		</div>
	)
});
