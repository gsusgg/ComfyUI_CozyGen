const BASE_URL = '/cozygen';

export const getWorkflows = async () => {
  const response = await fetch(`${BASE_URL}/workflows`);
  if (!response.ok) {
    throw new Error('Failed to fetch workflows');
  }
  return response.json();
};

export const getWorkflow = async (filename) => {
  const response = await fetch(`${BASE_URL}/workflows/${filename}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch workflow: ${filename}`);
  }
  return response.json();
};

export const queuePrompt = async (prompt) => {
    const response = await fetch(window.location.protocol + '//' + window.location.host + '/prompt', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(prompt)
    });
    if (!response.ok) {
        throw new Error('Failed to queue prompt');
    }
    return response.json();
};

export const getGallery = async (subfolder = '') => {
    const response = await fetch(`${BASE_URL}/gallery?subfolder=${encodeURIComponent(subfolder)}`);
    if (!response.ok) {
        throw new Error('Failed to fetch gallery items');
    }
    return response.json();
};

export const getChoices = async (type) => {
  const response = await fetch(`${BASE_URL}/get_choices?type=${encodeURIComponent(type)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch choices for type: ${type}`);
  }
  return response.json();
};