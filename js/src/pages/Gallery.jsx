import React, { useState, useEffect } from 'react';
import { getGallery } from '../api';
import GalleryItem from '../components/GalleryItem';
import Modal from 'react-modal'; // Using react-modal for accessibility
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

// Modal styles
const customStyles = {
  content: {
    position: 'relative',
    top: 'auto',
    left: 'auto',
    right: 'auto',
    bottom: 'auto',
    transform: 'none',
    marginRight: '0',
    backgroundColor: '#2D3748',
    border: 'none',
    borderRadius: '8px',
    padding: '0rem',
    maxHeight: '90vh',
    width: '90vw',
    maxWidth: '864px',
    overflow: 'auto',
    flexShrink: 0,
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  }
};

Modal.setAppElement('#root');

const Gallery = () => {
    const [items, setItems] = useState([]);
    const [path, setPath] = useState(localStorage.getItem('galleryPath') || '');
    const [modalIsOpen, setModalIsOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        const fetchGallery = async () => {
            try {
                const galleryData = await getGallery(path, page);
                if (galleryData && galleryData.items) {
                    setItems(galleryData.items);
                    setTotalPages(galleryData.total_pages);
                } else {
                    setItems([]);
                    setTotalPages(1);
                }
            } catch (error) {
                console.error(error);
                setItems([]);
                setTotalPages(1);
            }
        };
        fetchGallery();
        localStorage.setItem('galleryPath', path);
    }, [path, page]);

    const handleSelect = (item) => {
        if (item.type === 'directory') {
            setPath(item.subfolder);
            setPage(1);
        } else {
            setSelectedItem(item);
            setModalIsOpen(true);
        }
    };

    const handleBreadcrumbClick = (index) => {
        const normalizedPath = path.replace(/\\/g, '/');
        const pathSegments = normalizedPath.split('/').filter(Boolean);
        const newPath = pathSegments.slice(0, index).join('/');
        setPath(newPath);
        setPage(1);
    };

    const handleFolderUp = () => {
        const normalizedPath = path.replace(/\\/g, '/');
        const pathSegments = normalizedPath.split('/').filter(Boolean);
        if (pathSegments.length > 0) {
            const newPath = pathSegments.slice(0, -1).join('/');
            setPath(newPath);
        } else {
            setPath(''); // Already at root, ensure path is empty
        }
        setPage(1);
    };

    const handleNext = () => {
        const images = items.filter(item => item.type !== 'directory');
        if (images.length <= 1) return;
        const currentIndex = images.findIndex(item => item.filename === selectedItem.filename && item.subfolder === selectedItem.subfolder);
        const nextIndex = (currentIndex + 1) % images.length;
        setSelectedItem(images[nextIndex]);
    };

    const handlePrevious = () => {
        const images = items.filter(item => item.type !== 'directory');
        if (images.length <= 1) return;
        const currentIndex = images.findIndex(item => item.filename === selectedItem.filename && item.subfolder === selectedItem.subfolder);
        const prevIndex = (currentIndex - 1 + images.length) % images.length;
        setSelectedItem(images[prevIndex]);
    };

    const breadcrumbs = path.split(/[\/]/).filter(Boolean); // Handle both windows and unix paths

    return (
        <div className="p-4">
            <div className="mb-4 bg-base-200 rounded-lg p-2 flex items-center text-lg">
                <span onClick={() => { setPath(''); setPage(1); }} className="cursor-pointer hover:text-accent transition-colors">Gallery</span>
                {breadcrumbs.map((segment, index) => (
                    <React.Fragment key={index}>
                        <span className="mx-2 text-gray-500">/</span>
                        <span onClick={() => handleBreadcrumbClick(index + 1)} className="cursor-pointer hover:text-accent transition-colors">{segment}</span>
                    </React.Fragment>
                ))}
                {/* Folder Up Button */}
                <button
                    onClick={handleFolderUp}
                    disabled={path === ''} // Disable if at root
                    className="ml-auto px-3 py-1 bg-base-300 text-gray-300 rounded-md text-sm hover:bg-base-300/70 transition-colors flex items-center"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
                    </svg>
                    Up
                </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {items.map(item => (
                    <GalleryItem key={item.filename} item={item} onSelect={handleSelect} />
                ))}
            </div>

            <div className="flex justify-center items-center space-x-4 mt-4">
                <button
                    onClick={() => setPage(page > 1 ? page - 1 : 1)}
                    disabled={page <= 1}
                    className="px-4 py-2 bg-base-300 text-white rounded-md disabled:opacity-50"
                >
                    Previous
                </button>
                <span>
                    Page {page} of {totalPages}
                </span>
                <button
                    onClick={() => setPage(page < totalPages ? page + 1 : totalPages)}
                    disabled={page >= totalPages}
                    className="px-4 py-2 bg-base-300 text-white rounded-md disabled:opacity-50"
                >
                    Next
                </button>
            </div>

            {selectedItem && (
                <Modal
                    isOpen={modalIsOpen}
                    onRequestClose={() => setModalIsOpen(false)}
                    style={customStyles}
                    contentLabel="Image Preview"
                >
                    <div className="flex flex-col h-full w-full">
                        <div className="flex-grow flex items-center justify-center min-h-0">
                            <TransformWrapper
                                initialScale={1}
                                minScale={0.5}
                                maxScale={5}
                                limitToBounds={false}
                                doubleClick={{ disabled: true }}
                                wheel={true}
                            >
                                <TransformComponent>
                                    <img src={`/view?filename=${selectedItem.filename}&subfolder=${selectedItem.subfolder}&type=output`} alt={selectedItem.filename} className="max-w-full max-h-full object-contain rounded-lg" />
                                </TransformComponent>
                            </TransformWrapper>
                        </div>
                        <div className="flex-shrink-0 p-2 flex justify-center items-center space-x-4">
                            <button
                                onClick={handlePrevious}
                                className="p-2 bg-base-300 text-gray-300 rounded-full hover:bg-base-300/70 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                                </svg>
                            </button>
                            <button
                                onClick={() => setModalIsOpen(false)}
                                className="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent-focus transition-colors"
                            >
                                Close
                            </button>
                            <button
                                onClick={handleNext}
                                className="p-2 bg-base-300 text-gray-300 rounded-full hover:bg-base-300/70 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}

export default Gallery;