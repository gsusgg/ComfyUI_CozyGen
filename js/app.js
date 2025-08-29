document.addEventListener('DOMContentLoaded', () => {
    const controlsContainer = document.getElementById('controls');
    const generateButton = document.getElementById('generate-button');
    const previewContainer = document.getElementById('preview');
    const workflowDropdown = document.getElementById('workflow-dropdown');
    const viewGalleryButton = document.getElementById('view-gallery-button'); // New

    // Modal elements
    const imageModal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    const closeButton = document.getElementsByClassName('close-button')[0];

    // Event listener for image preview click
    previewContainer.addEventListener('click', () => {
        const currentImage = previewContainer.querySelector('img');
        if (currentImage) {
            modalImage.src = currentImage.src;
            imageModal.style.display = 'flex';
        }
    });

    // Event listener for close button
    closeButton.addEventListener('click', () => {
        imageModal.style.display = 'none';
    });

    // Event listener for clicking outside the image to close the modal
    imageModal.addEventListener('click', (event) => {
        if (event.target === imageModal) {
            imageModal.style.display = 'none';
        }
    });

    let workflow = null;
    const client_id = Math.random().toString(36).substring(2);
    let socket = null;

    function setupWebSocket() {
        socket = new WebSocket(`ws://${window.location.host}/ws`);

        socket.onopen = () => {
            console.log('WebSocket connection established.');
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log("CozyGen: Raw WebSocket message received:", data); // Keep general log for now

            if (data.type === 'cozygen_image_ready') { // Listen for our custom message
                console.log("CozyGen: Custom image ready received:", data.data);
                const imageUrl = data.data.image_url;
                const img = document.createElement('img');
                img.src = imageUrl;
                previewContainer.innerHTML = '';
                previewContainer.appendChild(img);
            }
        };

        socket.onclose = () => {
            console.log('WebSocket connection closed. Reconnecting...');
            setTimeout(setupWebSocket, 1000);
        };
    }

    // New function to populate the dropdown
    async function populateWorkflowDropdown() {
         try {
             const response = await fetch('/cozygen/workflows');
             if (!response.ok) {
                 throw new Error('Failed to load workflow list.');
             }
             const data = await response.json();
             const workflows = data.workflows;
 
             workflowDropdown.innerHTML = '';
 
             if (workflows.length === 0) {
                 // Handle case with no workflows
                 const option = document.createElement('option');
                 option.textContent = 'No workflows found in /workflows folder';
                 option.disabled = true;
                 workflowDropdown.appendChild(option);
                 return null; // No default workflow
             }
  
             // Add all workflow options
             workflows.forEach(wf => {
                 const option = document.createElement('option');
                 option.value = wf;
                 option.textContent = wf;
                 workflowDropdown.appendChild(option);
             });
  
             // Set initial selection to the first workflow
             const defaultWorkflow = workflows[0];
             workflowDropdown.value = defaultWorkflow;
             return defaultWorkflow; // Return the name of the default workflow
         } catch (error) {
             console.error('Error populating workflow dropdown:', error);
             workflowDropdown.innerHTML = '';
             const option = document.createElement('option');
             option.textContent = 'Error loading workflows';
             option.disabled = true;
             workflowDropdown.appendChild(option);
             return null;
         }
     }
  
     // Modified loadWorkflow to accept a filename
     async function loadWorkflow(workflowFileName) {
         if (!workflowFileName) {
             controlsContainer.innerHTML = `<p>Please select a workflow.</p>`;
             return;
         }
         try {
             // ALWAYS fetch from the dedicated workflows endpoint for consistency.
             const fetchUrl = `/cozygen/workflows/${workflowFileName}`;
  
             const response = await fetch(fetchUrl);
             if (!response.ok) {
                 throw new Error(`Failed to load workflow: ${workflowFileName}`);
             }
             workflow = await response.json();
             renderControls();
         } catch (error) {
             console.error(error);
             controlsContainer.innerHTML = `<p>Error loading workflow: ${workflowFileName}. Make sure it's a valid workflow JSON.</p>`;
         }
     }

     function createParameterControl(id, node) {
         const controlWrapper = document.createElement('div');
         controlWrapper.className = 'control-wrapper';
 
         const { title, type, default: defaultValue, min, max, choices: choicesString } = node.inputs;
 
         const label = document.createElement('label');
         label.textContent = title;
 
         let input;
         if (type === 'INT' || type === 'FLOAT') {
             input = document.createElement('input');
             input.type = 'number';
             input.min = min;
             input.max = max;
             input.value = defaultValue;
             if (type === 'FLOAT') input.step = '0.01';
         } else if (type === 'DROPDOWN') {
             input = document.createElement('select');
             if (choicesString) {
                 choicesString.split(',').map(c => c.trim()).forEach(choice => {
                     const option = document.createElement('option');
                     option.value = choice;
                     option.textContent = choice;
                     input.appendChild(option);
                 });
             }
             input.value = defaultValue;
         } else { // STRING
             input = document.createElement('input');
             input.type = 'text';
             input.value = defaultValue;
         }
 
         input.dataset.nodeId = id;
         controlWrapper.appendChild(label);
         controlWrapper.appendChild(input);
 
         return controlWrapper;
     }
 
     function createDynamicInputControl(id, node) {
         const controlWrapper = document.createElement('div');
         controlWrapper.className = 'control-wrapper';
 
         const { param_name, param_type, default_value, min_value, max_value, choices, multiline, Multiline, add_randomize_toggle } = node.inputs;
 
         const label = document.createElement('label');
         label.textContent = param_name;
 
         let input;
         if (param_type === 'INT' || param_type === 'FLOAT') {
             input = document.createElement('input');
             input.type = 'number';
             input.min = min_value;
             input.max = max_value;
             input.value = default_value;
             if (param_type === 'FLOAT') input.step = '0.01';
         } else if (param_type === 'DROPDOWN') {
             input = document.createElement('select');
             if (choices) {
                 choices.split(',').map(c => c.trim()).forEach(choice => {
                     const option = document.createElement('option');
                     option.value = choice;
                     option.textContent = choice;
                     input.appendChild(option);
                 });
             }
             input.value = default_value;
         } else if (param_type === 'BOOLEAN') {
             input = document.createElement('input');
             input.type = 'checkbox';
             input.checked = (default_value.toLowerCase() === 'true');
         } else { // STRING
            if (multiline || Multiline) {
                input = document.createElement('textarea');
                input.rows = 3;
                input.addEventListener('input', () => {
                    input.style.height = 'auto';
                    input.style.height = (input.scrollHeight) + 'px';
                });
            } else {
                input = document.createElement('input');
                input.type = 'text';
            }
            input.value = default_value;
         }
 
         if (label && input) {
            input.dataset.nodeId = id;
            input.dataset.inputName = 'default_value';
            controlWrapper.appendChild(label);
            controlWrapper.appendChild(input);
         }

         if ((param_type === 'INT' || param_type === 'FLOAT') && add_randomize_toggle) {
            const randomizeContainer = document.createElement('div');
            randomizeContainer.className = 'randomize-container'; // Use a more generic class name
            const randomizeCheckbox = document.createElement('input');
            randomizeCheckbox.type = 'checkbox';
            randomizeCheckbox.id = `randomize-control-${id}`; // More generic ID
            randomizeCheckbox.dataset.nodeId = id;
            randomizeCheckbox.checked = false;
            const randomizeLabel = document.createElement('label');
            randomizeLabel.htmlFor = `randomize-control-${id}`;
            randomizeLabel.textContent = 'Randomize'; // Simpler label
            randomizeContainer.appendChild(randomizeCheckbox);
            randomizeContainer.appendChild(randomizeLabel);
            controlWrapper.appendChild(randomizeContainer);
        }
 
         return controlWrapper;
     }
 
     function renderControls() {
         if (!workflow) return;
         controlsContainer.innerHTML = '';
 
         // Get all nodes that should be rendered as controls
         const parameterNodes = Object.entries(workflow).filter(([, node]) => node.class_type === 'CozyGenParameter');
         const dynamicInputNodes = Object.entries(workflow).filter(([, node]) => node.class_type === 'CozyGenDynamicInput');
 
         // Combine them into a single list
         const allControlNodes = [...parameterNodes, ...dynamicInputNodes];
 
         // Sort the combined list by priority. Both node types are expected to have a 'priority' input.
         allControlNodes.sort(([, a], [, b]) => {
             const priorityA = a.inputs.priority || 0;
             const priorityB = b.inputs.priority || 0;
             return priorityA - priorityB;
         });
 
         // Process the sorted list to render controls, grouping where necessary
         let i = 0;
         while (i < allControlNodes.length) {
             const [id, node] = allControlNodes[i];
             const classType = node.class_type;
             const type = (classType === 'CozyGenParameter') ? node.inputs.type : node.inputs.param_type;
 
             let group = [];
             if (type === 'INT' || type === 'FLOAT') {
                 // Check for a consecutive group of number inputs
                 for (let j = i; j < allControlNodes.length; j++) {
                     const [, groupNode] = allControlNodes[j];
                     const groupClassType = groupNode.class_type;
                     const groupType = (groupClassType === 'CozyGenParameter') ? groupNode.inputs.type : groupNode.inputs.param_type;
 
                     if (['INT', 'FLOAT'].includes(groupType)) {
                         group.push(allControlNodes[j]);
                     } else {
                         break;
                     }
                 }
             }
 
             if (group.length > 1) {
                 // Render a group of controls side-by-side
                 const groupContainer = document.createElement('div');
                 groupContainer.className = 'control-group';
                 group.forEach(([groupId, groupNode]) => {
                     const createFn = (groupNode.class_type === 'CozyGenParameter') ? createParameterControl : createDynamicInputControl;
                     groupContainer.appendChild(createFn(groupId, groupNode));
                 });
                 controlsContainer.appendChild(groupContainer);
                 i += group.length; // Move index past the group
             } else {
                 // Render a single, full-width control
                 const createFn = (classType === 'CozyGenParameter') ? createParameterControl : createDynamicInputControl;
                 const controlElement = createFn(id, node);
                 controlElement.classList.add('full-width');
                 controlsContainer.appendChild(controlElement);
                 i++; // Move to the next item
             }
         }
     }

    async function queuePrompt() {
        if (!workflow) return;

        // Create a deep copy of the workflow to avoid modifying the original
        const workflowToSend = JSON.parse(JSON.stringify(workflow));

        // Collect current parameter values from UI
        const parameterValues = {};
        // Select all relevant input elements
        const inputs = controlsContainer.querySelectorAll('input[type="text"], input[type="number"], input[type="checkbox"], select, textarea');
        inputs.forEach(input => {
            const nodeId = input.dataset.nodeId;
            const inputName = input.dataset.inputName || 'default'; // For CozyGenParameter, it's 'default', for CozyGenDynamicInput, it's 'default_value'
            const node = workflow[nodeId];

            let nodeType;
            if (node.class_type === 'CozyGenDynamicInput') {
                nodeType = node.inputs.param_type;
            } else {
                nodeType = node.inputs.type;
            }

            let value;
            if (input.type === 'checkbox') {
                value = input.checked;
            } else {
                value = input.value;
            }

            // Special handling for randomization
            if (node.class_type === 'CozyGenDynamicInput' && (node.inputs.param_type === 'INT' || node.inputs.param_type === 'FLOAT')) {
                const randomizeCheckbox = document.getElementById(`randomize-control-${nodeId}`);
                if (randomizeCheckbox && randomizeCheckbox.checked) {
                    value = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
                    // Update the input field with the new random value
                    const numberInput = document.querySelector(`input[data-node-id="${nodeId}"][data-input-name="default_value"]`);
                    if(numberInput) numberInput.value = value;
                }
            }

            // Convert value to correct type based on node definition
            if (nodeType === 'INT') {
                value = parseInt(value);
            }
            else if (nodeType === 'FLOAT') {
                value = parseFloat(value);
            }
            else if (nodeType === 'BOOLEAN') {
                value = (value === true || value === "true");
            }
            // DROPDOWN and STRING values are already strings

            // Store the value, keyed by nodeId and inputName
            if (!parameterValues[nodeId]) {
                parameterValues[nodeId] = {};
            }
            parameterValues[nodeId][inputName] = value;
        });

        // Iterate through the workflow to inject parameter values and remove CozyGenParameter nodes
        const nodesToDelete = [];
        for (const nodeId in workflowToSend) {
            const node = workflowToSend[nodeId];

            // If it's a CozyGenParameter node, mark it for a deletion
            if (node.class_type === 'CozyGenParameter') {
                nodesToDelete.push(nodeId);
                continue; // Skip processing inputs for CozyGenParameter nodes
            }

            // If it's a CozyGenDynamicInput node, update its default_value input
            if (node.class_type === 'CozyGenDynamicInput') {
                if (parameterValues[nodeId] && parameterValues[nodeId].default_value !== undefined) {
                    node.inputs.default_value = parameterValues[nodeId].default_value;
                }
                // No need to delete CozyGenDynamicInput nodes, as they remain in the workflow
                continue; // Skip processing inputs for CozyGenDynamicInput nodes here
            }

            // Iterate through inputs of other nodes to replace CozyGenParameter references
            if (node.inputs) {
                for (const inputName in node.inputs) {
                    const inputValue = node.inputs[inputName];

                    // Check if the input value is a reference to a CozyGenParameter or CozyGenDynamicInput node
                    if (Array.isArray(inputValue) && inputValue.length === 2) {
                        const referencedNodeId = inputValue[0];
                        const referencedNode = workflowToSend[referencedNodeId];

                        if (referencedNode && referencedNode.class_type === 'CozyGenParameter' && parameterValues.hasOwnProperty(referencedNodeId)) {
                            // Replace the reference with the actual value from CozyGenParameter
                            node.inputs[inputName] = parameterValues[referencedNodeId].default;
                        } else if (referencedNode && referencedNode.class_type === 'CozyGenDynamicInput' && parameterValues.hasOwnProperty(referencedNodeId)) {
                            // Replace the reference with the actual value from CozyGenDynamicInput
                            node.inputs[inputName] = parameterValues[referencedNodeId].default_value;
                        }
                    }
                }
            }
        }

        // Delete CozyGenParameter nodes from the workflowToSend
        nodesToDelete.forEach(id => {
            delete workflowToSend[id];
        });

        // Fix for CozyGenOutput node: rename 'image' input to 'images'
        for (const nodeId in workflowToSend) {
            const node = workflowToSend[nodeId];
            if (node.class_type === 'CozyGenOutput' && node.inputs && node.inputs.image) {
                node.inputs.images = node.inputs.image;
                delete node.inputs.image;
            }
        }

        const prompt = {
            prompt: workflowToSend,
            client_id: client_id
        };

        console.log('Prompt object being sent:', prompt); // Log the prompt object

        try {
            const response = await fetch('/prompt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(prompt)
            });

            if (!response.ok) {
                throw new Error('Failed to queue prompt');
            }

            const data = await response.json();
            console.log('Prompt queued:', data);

        } catch (error) {
            console.error(error);
        }
    }

    generateButton.addEventListener('click', queuePrompt);
    workflowDropdown.addEventListener('change', (event) => {
        loadWorkflow(event.target.value);
    });
    viewGalleryButton.addEventListener('click', () => {
        window.location.href = 'gallery.html';
    });

    async function initializeApp() {
        const defaultWorkflow = await populateWorkflowDropdown();
        if (defaultWorkflow) {
            await loadWorkflow(defaultWorkflow);
        }
        setupWebSocket();
    }

    initializeApp();
});
