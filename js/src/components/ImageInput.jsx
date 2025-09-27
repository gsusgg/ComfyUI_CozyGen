import React, { useState, useEffect } from 'react';
import { getGallery, uploadImage } from '../api';

const ImageInput = ({ input, value, onFormChange, onBypassToggle, disabled }) => {
    const [imageSource, setImageSource] = useState(value?.source || 'Upload'); // 'Upload' or 'Gallery'
    const [selectedGalleryImage, setSelectedGalleryImage] = useState(value?.path || '');
    const [uploadedFile, setUploadedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(value?.url || '');
    const [galleryItems, setGalleryItems] = useState([]);
    const [currentGalleryPath, setCurrentGalleryPath] = useState('');
    const [smartResize, setSmartResize] = useState(true);

    useEffect(() => {
        const fetchGallery = async () => {
            try {
                const items = await getGallery(currentGalleryPath);
                setGalleryItems(items);
            } catch (error) {
                console.error("Error fetching gallery items:", error);
            }
        };
        if (input.class_type !== 'CozyGenImageInput') { // Only fetch gallery if not CozyGenImageInput
            fetchGallery();
        }
    }, [currentGalleryPath, input.class_type]);

    useEffect(() => {
        // When the component mounts or input changes, set the initial preview URL
        if (input.class_type === 'CozyGenImageInput') {
            if (value) { // If value (filename) exists
                setPreviewUrl(`/view?filename=${value}&type=input`); // Construct URL from filename
            } else {
                setPreviewUrl('');
            }
        } else if (value?.url) {
            setPreviewUrl(value.url);
        } else if (value?.path && imageSource === 'Gallery') {
            // Construct URL for gallery image
            setPreviewUrl(`/view?filename=${value.path}&subfolder=&type=output`);
        }
    }, [value, imageSource, input.class_type]);

    const handleImageSourceChange = (e) => {
        const newSource = e.target.value;
        setImageSource(newSource);
        // Clear relevant states when switching source
        setSelectedGalleryImage('');
        setUploadedFile(null);
        setPreviewUrl('');
        onFormChange(input.inputs.param_name, { source: newSource, path: '', url: '' });
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            setUploadedFile(file);
            setPreviewUrl(URL.createObjectURL(file)); // Local preview
            try {
                const response = await uploadImage(file);
                // Update form data with the filename returned from the backend
                onFormChange(input.inputs.param_name, { source: 'Upload', path: response.filename, url: `/view?filename=${response.filename}&type=input` });
            } catch (error) {
                console.error("Error uploading image:", error);
                setPreviewUrl('');
            }
        }
    };

    const handleGallerySelect = (e) => {
        const selectedFilename = e.target.value;
        setSelectedGalleryImage(selectedFilename);
        const selectedItem = galleryItems.find(item => item.filename === selectedFilename);
        if (selectedItem) {
            const imageUrl = `/view?filename=${selectedItem.filename}&subfolder=${selectedItem.subfolder}&type=${selectedItem.type}`;
            setPreviewUrl(imageUrl);
            onFormChange(input.inputs.param_name, { source: 'Gallery', path: selectedItem.filename, subfolder: selectedItem.subfolder, url: imageUrl });
        }
    };

    const handleClearImage = () => {
        setImageSource('Upload');
        setSelectedGalleryImage('');
        setUploadedFile(null);
        setPreviewUrl('');
        onFormChange(input.inputs.param_name, { source: 'Upload', path: '', url: '' });
    };

    const handleCozyGenClear = () => {
        setPreviewUrl('');
        // Also clear the file input element itself
        const uploader = document.getElementById(`cozyGenImageUploader-${input.id}`);
        if (uploader) {
            uploader.value = null;
        }
        onFormChange(input.inputs.param_name, '');
    };

    const handleCozyGenFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (smartResize) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = async () => {
                    let { width, height } = img;
                    const sum = width + height;
                    if (sum > 2048) {
                        const ratio = width / height;
                        width = Math.floor(2048 * ratio / (ratio + 1));
                        height = 2048 - width;
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob(async (blob) => {
                        const resizedFile = new File([blob], file.name, { type: file.type });
                        setPreviewUrl(URL.createObjectURL(resizedFile));
                        try {
                            const response = await uploadImage(resizedFile);
                            const imageUrl = `/view?filename=${response.filename}&type=input`;
                            setPreviewUrl(imageUrl);
                            onFormChange(input.inputs.param_name, response.filename);
                        } catch (error) {
                            console.error("Error uploading image:", error);
                            setPreviewUrl('');
                        }
                    }, file.type);
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            setPreviewUrl(URL.createObjectURL(file));
            try {
                const response = await uploadImage(file);
                const imageUrl = `/view?filename=${response.filename}&subfolder=input&type=input`;
                setPreviewUrl(imageUrl);
                onFormChange(input.inputs.param_name, response.filename);
            } catch (error) {
                console.error("Error uploading image:", error);
                setPreviewUrl('');
            }
        }
    };

    const navigateGallery = (subfolder) => {
        setCurrentGalleryPath(subfolder);
        setSelectedGalleryImage(''); // Clear selection when navigating
    };

    return (
        <div className="form-control mb-4 p-3 bg-base-200 rounded-box shadow-lg">
            <div className="label flex justify-between items-center">
                <div className="flex items-center space-x-2">
                    <span className="label-text text-lg font-semibold">{input.inputs.param_name}</span>
                    <span className="text-xs text-gray-400">
                        (Bypass
                        <input
                            type="checkbox"
                            className="toggle toggle-sm toggle-accent ml-1"
                            checked={disabled}
                            onChange={(e) => onBypassToggle(input.inputs.param_name, e.target.checked)}
                        />)
                    </span>
                </div>
                {input.class_type === 'CozyGenImageInput' && !disabled && (
                    <button onClick={handleCozyGenClear} className="btn btn-xs btn-outline" disabled={disabled}>Clear</button>
                )}
            </div>

            {input.class_type === 'CozyGenImageInput' ? (
                <div className={`flex flex-col sm:flex-row items-center gap-4 ${disabled ? 'opacity-50' : ''}`}>
                    <div className="flex-grow w-full sm:w-auto">
                        <div className="flex items-center gap-2">
                            <input
                                type="file"
                                id={`cozyGenImageUploader-${input.id}`}
                                accept="image/png, image/jpeg, image/webp"
                                onChange={handleCozyGenFileChange}
                                className="file-input file-input-bordered w-full max-w-xs"
                                disabled={disabled}
                            />
                            <div className="form-control flex-row items-center justify-end">
                                <label className="label cursor-pointer flex items-center gap-2">
                                    <span className="label-text whitespace-nowrap">Smart Resize</span>
                                    <input type="checkbox" className="toggle" checked={smartResize} onChange={() => setSmartResize(!smartResize)} disabled={disabled} />
                                </label>
                            </div>
                        </div>
                    </div>
                    {/* Right Column: Image Preview Thumbnail */}
                    {previewUrl && (
                        <div className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden shadow-md border border-base-300 flex items-center justify-center bg-base-300">
                            <img src={previewUrl} alt="Image Preview" className="w-full h-full object-cover" />
                        </div>
                    )}
                </div>
            ) : (
                // Existing UI for other image input types
                <>
                    <div className="flex items-center space-x-2 mb-4">
                        <select
                            className="select select-bordered w-full max-w-xs"
                            value={imageSource}
                            onChange={handleImageSourceChange}
                        >
                            <option value="Upload">Upload Image</option>
                            <option value="Gallery">Select from Gallery</option>
                        </select>
                        <button onClick={handleClearImage} className="btn btn-sm btn-outline">Clear</button>
                    </div>

                    {imageSource === 'Upload' && (
                        <div className="mb-4">
                            <input
                                type="file"
                                className="file-input file-input-bordered w-full"
                                onChange={handleFileChange}
                                accept="image/*"
                            />
                        </div>
                    )}

                    {imageSource === 'Gallery' && (
                        <div className="mb-4">
                            <div className="flex items-center space-x-2 mb-2">
                                <span className="text-sm text-gray-400">Current Path: {currentGalleryPath || '/'}</span>
                                {currentGalleryPath && (
                                    <button onClick={() => navigateGallery('')} className="btn btn-xs btn-ghost">Back to Root</button>
                                )}
                            </div>
                            <select
                                className="select select-bordered w-full"
                                value={selectedGalleryImage}
                                onChange={handleGallerySelect}
                            >
                                <option value="">-- Select an image or directory --</option>
                                {galleryItems.map((item, index) => (
                                    <option key={index} value={item.filename}>
                                        {item.type === 'directory' ? `[DIR] ${item.filename}` : item.filename}
                                    </option>
                                ))}
                            </select>
                            {selectedGalleryImage && galleryItems.find(item => item.filename === selectedGalleryImage && item.type === 'directory') && (
                                <button onClick={() => navigateGallery(selectedGalleryImage)} className="btn btn-sm btn-primary mt-2">Open Directory</button>
                            )}
                        </div>
                    )}

                    {previewUrl && (
                        <div className="mt-4 flex justify-center">
                            <img src={previewUrl} alt="Image Preview" className="max-w-full h-auto rounded-lg shadow-md" style={{ maxHeight: '300px' }} />
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default ImageInput;