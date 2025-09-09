import React, { useState, useEffect } from 'react';
import { getGallery } from '../api';

const ImageInput = ({ input, value, onFormChange }) => {
    const [imageSource, setImageSource] = useState(value?.source || 'Upload'); // 'Upload' or 'Gallery'
    const [selectedGalleryImage, setSelectedGalleryImage] = useState(value?.path || '');
    const [uploadedFile, setUploadedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(value?.url || '');
    const [galleryItems, setGalleryItems] = useState([]);
    const [currentGalleryPath, setCurrentGalleryPath] = useState('');

    useEffect(() => {
        const fetchGallery = async () => {
            try {
                const items = await getGallery(currentGalleryPath);
                setGalleryItems(items);
            } catch (error) {
                console.error("Error fetching gallery items:", error);
            }
        };
        fetchGallery();
    }, [currentGalleryPath]);

    useEffect(() => {
        // When the component mounts or input changes, set the initial preview URL
        if (value?.url) {
            setPreviewUrl(value.url);
        } else if (value?.path && imageSource === 'Gallery') {
            // Construct URL for gallery image
            setPreviewUrl(`/view?filename=${value.path}&subfolder=&type=output`);
        }
    }, [value, imageSource]);

    const handleImageSourceChange = (e) => {
        const newSource = e.target.value;
        setImageSource(newSource);
        // Clear relevant states when switching source
        setSelectedGalleryImage('');
        setUploadedFile(null);
        setPreviewUrl('');
        onFormChange(input.inputs.param_name, { source: newSource, path: '', url: '' });
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setUploadedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result; // This is the Data URL (Base64)
                setPreviewUrl(base64String); // Use base64 string for local preview
                // Update form data with the base64 string
                onFormChange(input.inputs.param_name, { source: 'Upload', path: '', url: base64String });
            };
            reader.readAsDataURL(file); // Read file as Data URL
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

    const navigateGallery = (subfolder) => {
        setCurrentGalleryPath(subfolder);
        setSelectedGalleryImage(''); // Clear selection when navigating
    };

    return (
        <div className="form-control mb-4 p-4 bg-base-200 rounded-box shadow-lg">
            <label className="label">
                <span className="label-text text-lg font-semibold">{input.inputs.param_name}</span>
            </label>
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
        </div>
    );
};

export default ImageInput;
