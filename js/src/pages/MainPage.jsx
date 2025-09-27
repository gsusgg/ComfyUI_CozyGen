import React, { useState, useEffect, useRef } from 'react';
import WorkflowSelector from '../components/WorkflowSelector';
import DynamicForm from '../components/DynamicForm';
import ImageInput from '../components/ImageInput'; // Import ImageInput
import { getWorkflows, getWorkflow, queuePrompt, getChoices } from '../api';
import Modal from 'react-modal';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

// Modal styles (copied from Gallery.jsx for consistency)
const isVideo = (url) => /\.(mp4|webm)/i.test(url);

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

const renderPreviewContent = (url) => {
    if (!url) return null;
    if (isVideo(url)) {
        return <video src={url} controls autoPlay loop muted className="max-w-full max-h-full object-contain rounded-lg" />;
    } else {
        return <img src={url} alt="Generated preview" className="max-w-full max-h-full object-contain rounded-lg cursor-pointer" />;
    }
};

const renderModalContent = (url) => {
    if (!url) return null;
    if (isVideo(url)) {
        return <video src={url} controls autoPlay loop className="max-w-full max-h-full object-contain rounded-lg" />;
    } else {
        return (
            <TransformWrapper
                initialScale={1}
                minScale={0.5}
                maxScale={5}
                limitToBounds={false}
                doubleClick={{ disabled: true }}
                wheel={true}
            >
                <TransformComponent>
                    <img src={url} alt="Generated preview" className="max-w-full max-h-full object-contain rounded-lg" />
                </TransformComponent>
            </TransformWrapper>
        );
    }
};

// Function to find nodes by class_type
const findNodesByType = (workflow, type) => {
    if (!workflow) return [];
    // Convert the workflow object to an array of nodes, adding the id to each node
    const nodes = Object.entries(workflow).map(([id, node]) => ({ ...node, id }));
    return nodes.filter(node => node.class_type === type);
};

const choiceTypeMapping = {
  "clip_name1": "clip",
  "clip_name2": "clip",
  "unet_name": "unet",
  "vae_name": "vae",
  "sampler_name": "sampler",
  "scheduler": "scheduler",
  // Add more mappings as needed
};

function App() {
    const [workflows, setWorkflows] = useState([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState(
    localStorage.getItem('selectedWorkflow') || null
  );
  const [workflowData, setWorkflowData] = useState(null);
  const [dynamicInputs, setDynamicInputs] = useState([]);
  const [formData, setFormData] = useState({});
  const [randomizeState, setRandomizeState] = useState({});
  const [bypassedState, setBypassedState] = useState({});
  const [previewImages, setPreviewImages] = useState(JSON.parse(localStorage.getItem('lastPreviewImages')) || []);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const websocketRef = useRef(null);
  const [progressValue, setProgressValue] = useState(0);
  const [progressMax, setProgressMax] = useState(0);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [statusText, setStatusText] = useState('Generating...');
  const workflowDataRef = useRef(null);

  useEffect(() => {
    workflowDataRef.current = workflowData;
  }, [workflowData]);

  const openModalWithImage = (imageSrc) => {
    setSelectedPreviewImage(imageSrc);
    setModalIsOpen(true);
  };

  // --- WebSocket Connection ---
  useEffect(() => {
    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https' ? 'wss' : 'ws';
      const host = window.location.host;
      const wsUrl = `${protocol}://${host}/ws`;

      websocketRef.current = new WebSocket(wsUrl);

      websocketRef.current.onmessage = (event) => {
        if (typeof event.data !== 'string') {
            console.log("CozyGen: Received binary WebSocket message, ignoring.");
            return;
        }

        const msg = JSON.parse(event.data);

        if (msg.type === 'cozygen_batch_ready') {
            const imageUrls = msg.data.images.map(image => image.url);
            if (imageUrls.length > 0) {
                setPreviewImages(imageUrls);
                localStorage.setItem('lastPreviewImages', JSON.stringify(imageUrls));
            }
            setIsLoading(false);
            setProgressValue(0);
            setProgressMax(0);
            setStatusText('Finished');
        } else if (msg.type === 'executing') {
            const nodeId = msg.data.node;
            // If nodeId is null, it means the prompt is finished, but we wait for our own message.
            if (nodeId && workflowDataRef.current && workflowDataRef.current[nodeId]) {
                const node = workflowDataRef.current[nodeId];
                const nodeName = node.title || node.class_type;
                setStatusText(`Executing: ${nodeName}`);
            }
        } else if (msg.type === 'progress') {
            setProgressValue(msg.data.value);
            setProgressMax(msg.data.max);
        }
      };

      websocketRef.current.onclose = () => {
        setTimeout(connectWebSocket, 1000);
      };

      websocketRef.current.onerror = (err) => {
        console.error('CozyGen: WebSocket error: ', err);
        websocketRef.current.close();
      };
    };

    connectWebSocket();

    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, []);

  // --- Data Fetching ---
  useEffect(() => {
    const fetchWorkflows = async () => {
      try {
        const data = await getWorkflows();
        setWorkflows(data.workflows || []);
      } catch (error) {
        console.error(error);
      }
    };
    fetchWorkflows();
  }, []);

  useEffect(() => {
    if (!selectedWorkflow) return;

    const fetchWorkflowData = async () => {
      try {
        const data = await getWorkflow(selectedWorkflow);
        setWorkflowData(data);

        // Ensure param_name is present in CozyGenImageInput nodes within the workflowData
        for (const nodeId in data) {
            const node = data[nodeId];
            if (node.class_type === 'CozyGenImageInput') {
                if (!node.inputs.param_name) {
                    node.inputs.param_name = "Image Input"; // Set default if missing
                }
            }
        }

        // New: Define all input types the UI should recognize
        const COZYGEN_INPUT_TYPES = [
            'CozyGenDynamicInput', 
            'CozyGenImageInput', 
            'CozyGenFloatInput', 
            'CozyGenIntInput', 
            'CozyGenStringInput',
            'CozyGenChoiceInput'
        ];

        // Find all nodes that are one of our recognized input types
        const allInputNodes = Object.values(data).filter(node => COZYGEN_INPUT_TYPES.includes(node.class_type));

        // Add the node's ID to its object for easy reference
        for (const nodeId in data) {
            if (COZYGEN_INPUT_TYPES.includes(data[nodeId].class_type)) {
                data[nodeId].id = nodeId;
            }
        }

        // Sort all inputs by the priority field
        allInputNodes.sort((a, b) => (a.inputs['priority'] || 0) - (b.inputs['priority'] || 0));

        // Fetch choices for dropdowns (applies to both Dynamic and Choice inputs)
        const inputsWithChoices = await Promise.all(allInputNodes.map(async (input) => {
            const isDynamicDropdown = input.class_type === 'CozyGenDynamicInput' && input.inputs['param_type'] === 'DROPDOWN';
            const isChoiceNode = input.class_type === 'CozyGenChoiceInput';

            if (isDynamicDropdown || isChoiceNode) {
                const param_name = input.inputs['param_name'];
                let choiceType = input.inputs['choice_type'] || (input.properties && input.properties['choice_type']);

                if (!choiceType && isDynamicDropdown) { // Fallback for older dynamic nodes
                    choiceType = choiceTypeMapping[param_name];
                }

                if (choiceType) {
                    try {
                        const choicesData = await getChoices(choiceType);
                        // For dynamic nodes, we put choices in a hidden field.
                        // For the new choice node, the JS will handle it, but we can preload here.
                        input.inputs.choices = choicesData.choices || [];
                    } catch (error) {
                        console.error(`Error fetching choices for ${param_name} (choiceType: ${choiceType}):`, error);
                        input.inputs.choices = [];
                    }
                }
            }
            return input;
        }));

        setDynamicInputs(inputsWithChoices);

        const savedFormData = JSON.parse(localStorage.getItem(`${selectedWorkflow}_formData`)) || {};
        
        // Initialize formData with default values if not already present
        const initialFormData = {};
        inputsWithChoices.forEach(input => { // Use inputsWithChoices here
            const param_name = input.inputs['param_name'];
            if (savedFormData[param_name] === undefined) {
                let defaultValue;
                if (['CozyGenDynamicInput', 'CozyGenFloatInput', 'CozyGenIntInput', 'CozyGenStringInput'].includes(input.class_type)) {
                    defaultValue = input.inputs['default_value'];
                    if (input.class_type === 'CozyGenIntInput') {
                        defaultValue = parseInt(defaultValue, 10);
                    } else if (input.class_type === 'CozyGenFloatInput') {
                        defaultValue = parseFloat(defaultValue);
                    }
                } else if (input.class_type === 'CozyGenChoiceInput') {
                    defaultValue = input.inputs.choices && input.inputs.choices.length > 0 ? input.inputs.choices[0] : '';
                } else if (input.class_type === 'CozyGenImageInput') {
                    defaultValue = '';
                }
                initialFormData[param_name] = defaultValue;
            } else {
                initialFormData[param_name] = savedFormData[param_name];
            }
        });
        setFormData(initialFormData);

        const savedRandomizeState = JSON.parse(localStorage.getItem(`${selectedWorkflow}_randomizeState`)) || {};
        setRandomizeState(savedRandomizeState);

        const savedBypassedState = JSON.parse(localStorage.getItem(`${selectedWorkflow}_bypassedState`)) || {};
        setBypassedState(savedBypassedState);

      } catch (error) {
        console.error(error);
      }
    };

    fetchWorkflowData();
  }, [selectedWorkflow]);

  // --- Handlers ---
  const handleWorkflowSelect = (workflow) => {
    setSelectedWorkflow(workflow);
    localStorage.setItem('selectedWorkflow', workflow);
    setWorkflowData(null);
    setDynamicInputs([]);
    setFormData({});
    setRandomizeState({});
    setPreviewImage(null);
  };

  const handleFormChange = (inputName, value) => {
    const newFormData = { ...formData, [inputName]: value };
    setFormData(newFormData);
    localStorage.setItem(`${selectedWorkflow}_formData`, JSON.stringify(newFormData));
  };

  const handleRandomizeToggle = (inputName, isRandom) => {
    const newRandomizeState = { ...randomizeState, [inputName]: isRandom };
    setRandomizeState(newRandomizeState);
    localStorage.setItem(`${selectedWorkflow}_randomizeState`, JSON.stringify(newRandomizeState));
  };

  const handleBypassToggle = (inputName, isBypassed) => {
    const newBypassedState = { ...bypassedState, [inputName]: isBypassed };
    setBypassedState(newBypassedState);
    localStorage.setItem(`${selectedWorkflow}_bypassedState`, JSON.stringify(newBypassedState));
  };

  

  const handleGenerate = async () => {
    if (!workflowData) return;
    setIsLoading(true);
    setPreviewImages([]); // Clear previous images
    setStatusText('Queuing prompt...');

    try {
        let finalWorkflow = JSON.parse(JSON.stringify(workflowData));

        // --- Bypass logic for Image Inputs (Simplified) ---
        const bypassedImageNodes = dynamicInputs.filter(dn => bypassedState[dn.inputs.param_name] && dn.class_type === 'CozyGenImageInput');
        for (const bypassedNode of bypassedImageNodes) {
            // When an image input is bypassed, just remove it.
            // The workflow should be constructed to handle this (e.g., have a separate default path).
            if (finalWorkflow[bypassedNode.id]) {
                // To prevent crashes, we also need to nullify any inputs that point to this node.
                for (const nodeId in finalWorkflow) {
                    for (const inputName in finalWorkflow[nodeId].inputs) {
                        const input = finalWorkflow[nodeId].inputs[inputName];
                        if (Array.isArray(input) && input[0] === bypassedNode.id) {
                            finalWorkflow[nodeId].inputs[inputName] = null;
                        }
                    }
                }
                delete finalWorkflow[bypassedNode.id];
            }
        }

        // --- Bypass and Value Injection Logic (condensed for brevity) ---
        const COZYGEN_INPUT_TYPES_WITH_BYPASS = ['CozyGenDynamicInput', 'CozyGenChoiceInput'];
        const bypassedNodes = dynamicInputs.filter(dn => bypassedState[dn.inputs.param_name] && COZYGEN_INPUT_TYPES_WITH_BYPASS.includes(dn.class_type));
        
        for (const bypassedNode of bypassedNodes) {
            // Find the node that our CozyGen input is connected to (e.g., a LoraLoader).
            let targetNodeId = Object.keys(finalWorkflow).find(id => 
                Object.values(finalWorkflow[id].inputs).some(input => Array.isArray(input) && input[0] === bypassedNode.id)
            );

            if (!targetNodeId) continue;

            const targetNode = finalWorkflow[targetNodeId];

            // Find the "real" upstream input to the target node (e.g., the model output from a previous loader).
            // This is the input we want to connect *past* the bypassed node.
            const upstreamSources = {};
            for (const inputName in targetNode.inputs) {
                const input = targetNode.inputs[inputName];
                if (Array.isArray(input) && finalWorkflow[input[0]] && !COZYGEN_INPUT_TYPES_WITH_BYPASS.includes(finalWorkflow[input[0]].class_type)) {
                    upstreamSources[inputName] = input;
                }
            }

            // If there's no other upstream source, we can't bypass.
            if (Object.keys(upstreamSources).length === 0) continue;

            // Find all nodes that are connected to our target node.
            const downstreamConnections = [];
            for (const nodeId in finalWorkflow) {
                for (const inputName in finalWorkflow[nodeId].inputs) {
                    const input = finalWorkflow[nodeId].inputs[inputName];
                    if (Array.isArray(input) && input[0] === targetNodeId) {
                        downstreamConnections.push({ nodeId, inputName });
                    }
                }
            }

            // Rewire the downstream connections to point to the upstream source, skipping the target.
            for (const conn of downstreamConnections) {
                // The input name on the downstream node should match the input name on the target node
                // that had the upstream source. E.g., 'MODEL' -> 'MODEL'.
                const upstreamSource = upstreamSources[conn.inputName];
                if (upstreamSource) {
                    finalWorkflow[conn.nodeId].inputs[conn.inputName] = upstreamSource;
                }
            }

            // Delete the bypassed nodes from the workflow.
            delete finalWorkflow[targetNodeId];
            delete finalWorkflow[bypassedNode.id];
        }

        let updatedFormData = { ...formData };
        dynamicInputs.forEach(dynamicNode => {
            if (!finalWorkflow[dynamicNode.id]) return;
            const param_name = dynamicNode.inputs.param_name;
            if (dynamicNode.class_type === 'CozyGenImageInput') return;
            let valueToInject = randomizeState[param_name] 
                ? (dynamicNode.inputs.param_type === 'FLOAT' ? Math.random() * ((dynamicNode.inputs.max_value || 1000000) - (dynamicNode.inputs.min_value || 0)) + (dynamicNode.inputs.min_value || 0) : Math.floor(Math.random() * ((dynamicNode.inputs.max_value || 1000000) - (dynamicNode.inputs.min_value || 0) + 1)) + (dynamicNode.inputs.min_value || 0))
                : formData[param_name];
            updatedFormData[param_name] = valueToInject;

            const nodeToUpdate = finalWorkflow[dynamicNode.id];
            if (nodeToUpdate) {
                if (['CozyGenFloatInput', 'CozyGenIntInput', 'CozyGenStringInput', 'CozyGenDynamicInput'].includes(dynamicNode.class_type)) {
                    nodeToUpdate.inputs.default_value = valueToInject;
                } else if (dynamicNode.class_type === 'CozyGenChoiceInput') {
                    nodeToUpdate.inputs.value = valueToInject;
                }
            }
        });
        setFormData(updatedFormData);
        localStorage.setItem(`${selectedWorkflow}_formData`, JSON.stringify(updatedFormData));

        const imageInputNodes = dynamicInputs.filter(dn => dn.class_type === 'CozyGenImageInput');
        for (const node of imageInputNodes) {
            // Skip validation if the node is bypassed
            if (bypassedState[node.inputs.param_name]) {
                continue;
            }

            const image_filename = formData[node.inputs.param_name];
            if (!image_filename) {
                alert(`Please upload an image for "${node.inputs.param_name}" before generating.`);
                setIsLoading(false);
                return;
            }
            if (finalWorkflow[node.id]) {
                finalWorkflow[node.id].inputs.image_filename = image_filename;
            }
        }

        await queuePrompt({ prompt: finalWorkflow });

    } catch (error) {
        console.error("Failed to queue prompt:", error);
        setIsLoading(false);
        setStatusText('Error queuing prompt');
    }
  };

  const handleClearPreview = () => {
    setPreviewImages([]);
    localStorage.removeItem('lastPreviewImages');
  };

  const hasImageInput = dynamicInputs.some(input => input.class_type === 'CozyGenImageInput');

  return (
    <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-28">
            {/* Right Column: Preview & Generate Button */}
            <div className="flex flex-col space-y-2">
                <div className="bg-base-200 shadow-lg rounded-lg p-3 min-h-[400px] lg:min-h-[500px] flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-white">Preview</h2>
                        <button 
                            onClick={handleClearPreview}
                            className="px-3 py-1 bg-base-300 text-gray-300 rounded-md text-sm hover:bg-base-300/70 transition-colors"
                        >
                            Clear
                        </button>
                    </div>
                    <div className="flex-grow flex items-center justify-center border-2 border-dashed border-base-300 rounded-lg p-2 overflow-y-auto">
                        {isLoading && <div className="text-center w-full"><p className="text-lg">{statusText}</p></div>}
                        {!isLoading && previewImages.length === 0 && (
                            <p className="text-gray-400">Your generated image or video will appear here.</p>
                        )}
                        {!isLoading && previewImages.length === 1 && (
                            <div className="w-full h-full flex items-center justify-center cursor-pointer" onClick={() => openModalWithImage(previewImages[0])}>
                                {renderPreviewContent(previewImages[0])}
                            </div>
                        )}
                        {!isLoading && previewImages.length > 1 && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 w-full h-full">
                                {previewImages.map((src, index) => (
                                    <div key={index} className="aspect-square bg-base-300 rounded-lg overflow-hidden cursor-pointer" onClick={() => openModalWithImage(src)}>
                                        {renderPreviewContent(src)}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                {/* Generate button moved to sticky footer */}
            </div>
            {/* Left Column: Controls */}
            <div className="flex flex-col space-y-2">
                <WorkflowSelector 
                  workflows={workflows}
                  selectedWorkflow={selectedWorkflow}
                  onSelect={handleWorkflowSelect}
                />

                {/* New, Corrected Rendering Logic */}
                <DynamicForm
                    inputs={dynamicInputs
                        .filter(input => input.class_type !== 'CozyGenImageInput')
                        .map(input => {
                            // Map new static node properties to the format DynamicForm expects
                            if (['CozyGenFloatInput', 'CozyGenIntInput', 'CozyGenStringInput', 'CozyGenChoiceInput'].includes(input.class_type)) {
                                let param_type = input.class_type.replace('CozyGen', '').replace('Input', '').toUpperCase();
                                if (param_type === 'CHOICE') {
                                    param_type = 'DROPDOWN'; // Map Choice to Dropdown
                                }
                                return {
                                    ...input,
                                    inputs: {
                                        ...input.inputs,
                                        param_type: param_type,
                                        // Conform to the expected 'Multiline' prop
                                        Multiline: input.inputs.display_multiline || false, 
                                    }
                                };
                            }
                            return input; // Return original CozyGenDynamicInput as is
                        })
                    }
                    formData={formData}
                    onFormChange={handleFormChange}
                    randomizeState={randomizeState}
                    onRandomizeToggle={handleRandomizeToggle}
                    bypassedState={bypassedState}
                    onBypassToggle={handleBypassToggle}
                />

                {/* Render ImageInput separately */}
                {dynamicInputs.filter(input => input.class_type === 'CozyGenImageInput').map(input => (
                    <ImageInput
                        key={input.id}
                        input={input}
                        value={formData[input.inputs.param_name]}
                        onFormChange={handleFormChange}
                        onBypassToggle={handleBypassToggle}
                        disabled={bypassedState[input.inputs.param_name] || false}
                    />
                ))}
            </div>
        </div>

        {/* Sticky Generate Button Footer */}
        <div className="fixed bottom-0 left-0 right-0 bg-base-100/80 backdrop-blur-sm p-4 border-t border-base-300 z-10 shadow-lg">
            <div className="max-w-2xl mx-auto"> {/* Centered and max-width */}
                <button
                    onClick={handleGenerate}
                    disabled={isLoading || !workflowData}
                    className="w-full bg-accent text-white font-bold text-lg py-4 px-4 rounded-lg hover:bg-accent-focus transition duration-300 disabled:bg-base-300 disabled:cursor-not-allowed shadow-lg"
                >
                    {isLoading ? 'Generating...' : 'Generate'}
                </button>
                {(isLoading && progressMax > 0) && (
                    <div className="w-full bg-base-300 rounded-full h-2.5 mt-2">
                        <div
                            className="bg-accent h-2.5 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${(progressValue / progressMax) * 100}%` }}
                        ></div>
                    </div>
                )}
            </div>
        </div>

        {/* Image Preview Modal */}
        {selectedPreviewImage && (
            <Modal
                isOpen={modalIsOpen}
                onRequestClose={() => setModalIsOpen(false)}
                style={customStyles}
                contentLabel="Image Preview"
            >
                <div className="flex flex-col h-full w-full">
                    <div className="flex-grow flex items-center justify-center min-h-0">
                        {renderModalContent(selectedPreviewImage)}
                    </div>
                    <div className="flex-shrink-0 p-2 flex justify-center">
                        <button
                            onClick={() => setModalIsOpen(false)}
                            className="px-4 py-2 bg-accent text-white rounded-md hover:bg-accent-focus transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </Modal>
        )}
    </div>
  );
}
export default App;

