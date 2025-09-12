import React from 'react';

const GalleryItem = ({ item, onSelect }) => {
    const isDirectory = item.type === 'directory';
    const imageUrl = isDirectory ? '' : `/view?filename=${item.filename}&subfolder=${item.subfolder}&type=output`;

    return (
        <div 
            className="bg-base-200 rounded-lg shadow-lg overflow-hidden cursor-pointer group transform hover:-translate-y-1 transition-all duration-300"
            onClick={() => onSelect(item)}
        >
            <div className="relative w-full h-48">
                {isDirectory ? (
                    <div className="flex flex-col items-center justify-center h-full bg-base-300/50">
                        <svg className="w-16 h-16 text-gray-500 group-hover:text-accent transition-colors" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path></svg>
                    </div>
                ) : (
                    <img src={imageUrl} alt={item.filename} className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="p-2 text-sm text-white truncate">{item.filename}</p>
        </div>
    );
}

export default GalleryItem;