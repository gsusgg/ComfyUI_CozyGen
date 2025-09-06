import React, { useState, useEffect } from 'react';
import { getGallery } from '../api';
import GalleryItem from '../components/GalleryItem';
import Modal from 'react-modal'; // Using react-modal for accessibility
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

// Modal styles
const customStyles = {
  content: {
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    marginRight: '-50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: '#2D3748', // gray-800
    border: 'none',
    borderRadius: '8px',
    maxWidth: '90vw',
    maxHeight: '90vh',
    padding: '0.5rem'
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)'
  }
};

Modal.setAppElement('#root');

const Gallery = () => {
    const [items, setItems] = useState([]);
    const [path, setPath] = useState(localStorage.getItem('galleryPath') || '');
    const [modalIsOpen, setModalIsOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);

    useEffect(() => {
        const fetchGallery = async () => {
            try {
                const galleryItems = await getGallery(path);
                setItems(galleryItems);
            } catch (error) {
                console.error(error);
            }
        };
        fetchGallery();
        localStorage.setItem('galleryPath', path);
    }, [path]);

    const handleSelect = (item) => {
        if (item.type === 'directory') {
            setPath(item.subfolder);
        } else {
            setSelectedItem(item);
            setModalIsOpen(true);
        }
    };

    const handleBreadcrumbClick = (index) => {
        const pathSegments = path.split('/').filter(Boolean);
        const newPath = pathSegments.slice(0, index).join('/');
        setPath(newPath);
    };

    const breadcrumbs = path.split(/[\/]/).filter(Boolean); // Handle both windows and unix paths

    return (
        <div className="p-4">
            <div className="mb-4 bg-base-200 rounded-lg p-2 flex items-center text-lg">
                <span onClick={() => setPath('')} className="cursor-pointer hover:text-accent transition-colors">Gallery</span>
                {breadcrumbs.map((segment, index) => (
                    <React.Fragment key={index}>
                        <span className="mx-2 text-gray-500">/</span>
                        <span onClick={() => handleBreadcrumbClick(index + 1)} className="cursor-pointer hover:text-accent transition-colors">{segment}</span>
                    </React.Fragment>
                ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {items.map(item => (
                    <GalleryItem key={item.filename} item={item} onSelect={handleSelect} />
                ))}
            </div>

            {selectedItem && (
                <Modal
                    isOpen={modalIsOpen}
                    onRequestClose={() => setModalIsOpen(false)}
                    style={customStyles}
                    contentLabel="Image Details"
                >
                    <div className="flex flex-col lg:flex-row text-white gap-6">
                        <div className="flex-shrink-0">
                            <div className="flex-shrink-0">
                            <TransformWrapper
                                initialScale={1}
                                minScale={0.5}
                                maxScale={5}
                                limitToBounds={false}
                                doubleClick={{ disabled: true }}
                                wheel={{ activationKeys: ['Control'] }}
                                className="h-full w-full"
                            >
                                {({ zoomIn, zoomOut, resetTransform, ...rest }) => (
                                    <>
                                        <TransformComponent className="h-full w-full flex items-center justify-center">
                                            <img 
                                                src={`/view?filename=${selectedItem.filename}&subfolder=${selectedItem.subfolder}&type=output`}
                                                alt={selectedItem.filename} 
                                                className="max-w-full lg:max-w-2xl object-contain rounded-lg shadow-2xl"
                                            />
                                        </TransformComponent>
                                        <div className="tools mt-2 flex space-x-2">
                                            <button onClick={() => zoomIn()} className="px-3 py-1 bg-base-300 text-gray-300 rounded-md text-sm hover:bg-base-300/70 transition-colors">+</button>
                                            <button onClick={() => zoomOut()} className="px-3 py-1 bg-base-300 text-gray-300 rounded-md text-sm hover:bg-base-300/70 transition-colors">-</button>
                                            <button onClick={() => resetTransform()} className="px-3 py-1 bg-base-300 text-gray-300 rounded-md text-sm hover:bg-base-300/70 transition-colors">Reset</button>
                                        </div>
                                    </>
                                )}
                            </TransformWrapper>
                        </div>
                        </div>
                        <div className="flex-grow min-w-0">
                            <h2 className="text-2xl font-bold mb-4 break-words">{selectedItem.filename}</h2>
                            {selectedItem.metadata && (
                                <div className="bg-base-100 p-3 rounded-lg text-sm overflow-x-auto max-h-[70vh]">
                                    {selectedItem.metadata.prompt && (
                                        <div className="mb-2">
                                            <h3 className="font-semibold text-gray-400">Prompt:</h3>
                                            <p className="text-white whitespace-pre-wrap break-words">{selectedItem.metadata.prompt}</p>
                                        </div>
                                    )}
                                    {selectedItem.metadata.seed !== undefined && (
                                        <div className="mb-2">
                                            <h3 className="font-semibold text-gray-400">Seed:</h3>
                                            <p className="text-white">{selectedItem.metadata.seed}</p>
                                        </div>
                                    )}
                                    {selectedItem.metadata.full_workflow && (
                                        <div className="mt-4">
                                            <h3 className="font-semibold text-gray-400">Full Workflow:</h3>
                                            <pre className="text-white">{JSON.stringify(selectedItem.metadata.full_workflow, null, 2)}</pre>
                                        </div>
                                    )}
                                </div>
                            )}
                            <button onClick={() => setModalIsOpen(false)} className="mt-4 w-full bg-accent text-white font-bold py-2 px-4 rounded-lg hover:bg-accent-focus transition duration-300">
                                Close
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}

export default Gallery;