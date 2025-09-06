document.addEventListener('DOMContentLoaded', () => {
    const galleryContainer = document.getElementById('gallery-container');
    const breadcrumbContainer = document.getElementById('breadcrumb-container');
    const upButton = document.getElementById('up-button');

    // Modal elements
    const galleryImageModal = document.getElementById('gallery-image-modal');
    const galleryModalImage = document.getElementById('gallery-modal-image');
    const galleryModalPromptText = galleryImageModal.querySelector('.modal-prompt-text');
    const galleryCloseButton = galleryImageModal.querySelector('.close-button');

    async function fetchGallery(subfolder = '') {
        try {
            const response = await fetch(`/cozygen/gallery?subfolder=${encodeURIComponent(subfolder)}`);
            if (!response.ok) {
                throw new Error(`Failed to load gallery: ${response.statusText}`);
            }
            const galleryData = await response.json();
            renderGallery(galleryData, subfolder);
            renderBreadcrumbs(subfolder);
        } catch (error) {
            console.error(error);
            galleryContainer.innerHTML = '<p>Error loading gallery.</p>';
        }
    }

    function renderGallery(galleryData, currentSubfolder) {
        galleryContainer.innerHTML = '';

        if (galleryData.length === 0) {
            galleryContainer.innerHTML = '<p>This folder is empty.</p>';
            return;
        }

        for (const item of galleryData) {
            const galleryItem = document.createElement('div');
            galleryItem.classList.add('gallery-item');

            if (item.type === 'directory') {
                galleryItem.classList.add('directory-item');
                galleryItem.innerHTML = '<div class="folder-icon">&#128193;</div><div class="folder-name">' + item.filename + '</div>';
                galleryItem.addEventListener('click', () => {
                    const newSubfolder = item.subfolder;
                    window.location.search = `?subfolder=${encodeURIComponent(newSubfolder)}`;
                });
            } else if (item.type === 'output') {
                const img = document.createElement('img');
                img.src = `/view?filename=${item.filename}&subfolder=${item.subfolder}&type=output`;
                img.alt = item.filename;
                img.dataset.prompt = item.metadata ? item.metadata.positive_prompt : 'N/A';

                img.addEventListener('click', () => {
                    galleryModalImage.src = img.src;
                    galleryModalPromptText.textContent = `Prompt: ${img.dataset.prompt}`;
                    galleryImageModal.style.display = 'flex';
                });
                galleryItem.appendChild(img);
            }
            galleryContainer.appendChild(galleryItem);
        }
    }

    function renderBreadcrumbs(currentSubfolder) {
        breadcrumbContainer.innerHTML = '';
        const parts = currentSubfolder.split(/[\\/]/).filter(p => p);
        let path = '';

        const rootLink = document.createElement('a');
        rootLink.href = '?subfolder=';
        rootLink.textContent = 'Gallery';
        breadcrumbContainer.appendChild(rootLink);

        for (const part of parts) {
            path += (path ? '/' : '') + part;
            const separator = document.createElement('span');
            separator.textContent = ' / ';
            breadcrumbContainer.appendChild(separator);

            const partLink = document.createElement('a');
            partLink.href = `?subfolder=${encodeURIComponent(path)}`;
            partLink.textContent = part;
            breadcrumbContainer.appendChild(partLink);
        }
        
        // Show/hide up button
        upButton.style.display = currentSubfolder ? 'inline-block' : 'none';
    }

    function getParentFolder(subfolder) {
        const parts = subfolder.split(/[\\/]/).filter(p => p);
        parts.pop();
        return parts.join('/');
    }

    // --- Event Listeners ---
    upButton.addEventListener('click', () => {
        const params = new URLSearchParams(window.location.search);
        const currentSubfolder = params.get('subfolder') || '';
        const parentFolder = getParentFolder(currentSubfolder);
        window.location.search = `?subfolder=${encodeURIComponent(parentFolder)}`;
    });

    galleryCloseButton.addEventListener('click', () => {
        galleryImageModal.style.display = 'none';
    });

    galleryImageModal.addEventListener('click', (event) => {
        if (event.target === galleryImageModal) {
            galleryImageModal.style.display = 'none';
        }
    });

    // --- Initial Load ---
    const initialParams = new URLSearchParams(window.location.search);
    const initialSubfolder = initialParams.get('subfolder') || '';
    fetchGallery(initialSubfolder);
});