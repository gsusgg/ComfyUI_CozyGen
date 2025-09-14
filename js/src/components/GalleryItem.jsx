import React from 'react';

const isVideo = (filename) => /\.(mp4|webm)$/i.test(filename);
const isAudio = (filename) => /\.(mp3|wav|flac)$/i.test(filename);

const GalleryItem = ({ item, onSelect }) => {
    const isDirectory = item.type === 'directory';
    const fileUrl = isDirectory ? '' : `/view?filename=${item.filename}&subfolder=${item.subfolder}&type=output`;

    const renderContent = () => {
        if (isDirectory) {
            return (
                <div className="flex flex-col items-center justify-center h-full bg-base-300/50">
                    <svg className="w-16 h-16 text-gray-500 group-hover:text-accent transition-colors" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path></svg>
                </div>
            );
        } else if (isVideo(item.filename)) {
            return <video src={fileUrl} muted className="w-full h-full object-cover" />;
        } else if (isAudio(item.filename)) {
            return (
                <div className="flex flex-col items-center justify-center h-full bg-base-300/50">
                    <svg className="w-16 h-16 text-gray-500 group-hover:text-accent transition-colors" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" /></svg>
                </div>
            );
        } else {
            return <img src={fileUrl} alt={item.filename} className="w-full h-full object-cover" />;
        }
    };

    return (
        <div 
            className="bg-base-200 rounded-lg shadow-lg overflow-hidden cursor-pointer group transform hover:-translate-y-1 transition-all duration-300"
            onClick={() => onSelect(item)}
        >
            <div className="relative w-full h-48">
                {renderContent()}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="p-2 text-sm text-white truncate">{item.filename}</p>
        </div>
    );
}

export default GalleryItem;