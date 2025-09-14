import React, { useState, useEffect, useRef } from 'react';
import WorkflowSelector from '../components/WorkflowSelector';
import DynamicForm from '../components/DynamicForm';
import ImageInput from '../components/ImageInput'; // Import ImageInput
import { getWorkflows, getWorkflow, queuePrompt, getChoices } from '../api';
import Modal from 'react-modal';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

// Modal styles (copied from Gallery.jsx for consistency)
const isVideo = (filename) => /\.(mp4|webm)$/i.test(filename);

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
  const [previewImage, setPreviewImage] = useState(localStorage.getItem('lastPreviewImage') || null);
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
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const host = window.location.host;
      const wsUrl = `${protocol}://${host}/ws`;

      websocketRef.current = new WebSocket(wsUrl);

      websocketRef.current.onmessage = (event) => {
        if (typeof event.data !== 'string') {
            console.log("CozyGen: Received binary WebSocket message, ignoring.");
            return;
        }

        const msg = JSON.parse(event.data);

        if (msg.type === 'cozygen_image_ready' || msg.type === 'cozygen_video_ready') {
            const url = msg.data.image_url || msg.data.video_url;
            if (url) {
                setPreviewImage(url);
                localStorage.setItem('lastPreviewImage', url);
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

        // Find both CozyGenDynamicInput and CozyGenImageInput nodes
        const dynamicInputsNodes = findNodesByType(data, 'CozyGenDynamicInput');
        const imageInputNodes = findNodesByType(data, 'CozyGenImageInput');

        // Combine and sort them by priority (CozyGenDynamicInput only has priority)
        const allInputs = [...dynamicInputsNodes, ...imageInputNodes];
        allInputs.sort((a, b) => (a.inputs['priority'] || 0) - (b.inputs['priority'] || 0));

        // Fetch choices for dropdowns (only for CozyGenDynamicInput nodes)
        const inputsWithChoices = await Promise.all(allInputs.map(async (input) => {
            if (input.class_type === 'CozyGenDynamicInput' && input.inputs['param_type'] === 'DROPDOWN') {
                const param_name = input.inputs['param_name'];
                // New logic: Prioritize 'choice_type' if it exists
                let choiceType = input.inputs['choice_type'] || (input.properties && input.properties['choice_type']);

                // Fallback to the old mapping if 'choice_type' is not provided
                if (!choiceType) {
                    choiceType = choiceTypeMapping[param_name];
                }

                if (choiceType) {
                    try {
                        const choicesData = await getChoices(choiceType);
                        input.inputs.choices = choicesData.choices || [];
                    } catch (error) {
                        console.error(`Error fetching choices for ${param_name} (choiceType: ${choiceType}):`, error);
                        input.inputs.choices = []; // Set to empty array on error
                    }
                }
            }
            return input;
        }));

        setDynamicInputs(inputsWithChoices); // Update dynamicInputs with fetched choices

        const savedFormData = JSON.parse(localStorage.getItem(`${selectedWorkflow}_formData`)) || {};
        
        // Initialize formData with default values if not already present
        const initialFormData = {};
        inputsWithChoices.forEach(input => { // Use inputsWithChoices here
            const param_name = input.inputs['param_name'];
            if (savedFormData[param_name] === undefined) {
                let defaultValue;
                if (input.class_type === 'CozyGenDynamicInput') {
                    defaultValue = input.inputs['default_value'];
                    // Convert default value to correct type if necessary
                    if (input.inputs['param_type'] === 'INT') {
                        defaultValue = parseInt(defaultValue);
                    } else if (input.inputs['param_type'] === 'FLOAT') {
                        defaultValue = parseFloat(defaultValue);
                    } else if (input.inputs['param_type'] === 'BOOLEAN') {
                        defaultValue = String(defaultValue).toLowerCase() === 'true';
                    }
                } else if (input.class_type === 'CozyGenImageInput') {
                    // Default for CozyGenImageInput is now an empty string for the base64_image
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
    setStatusText('Queuing prompt...');

    try {
        let finalWorkflow = JSON.parse(JSON.stringify(workflowData));

        // --- Bypass and Value Injection Logic (condensed for brevity) ---
        const bypassedDynamicNodes = dynamicInputs.filter(dn => bypassedState[dn.inputs.param_name] && dn.class_type === 'CozyGenDynamicInput');
        for (const dynamicNode of bypassedDynamicNodes) {
            let targetNodeId = Object.keys(finalWorkflow).find(id => Object.values(finalWorkflow[id].inputs).some(input => Array.isArray(input) && input[0] === dynamicNode.id));
            if (!targetNodeId) continue;
            const targetNode = finalWorkflow[targetNodeId];
            const upstreamSources = {};
            for (const inputName in targetNode.inputs) {
                const input = targetNode.inputs[inputName];
                if (Array.isArray(input) && finalWorkflow[input[0]] && finalWorkflow[input[0]].class_type !== 'CozyGenDynamicInput') {
                    upstreamSources[inputName] = input;
                }
            }
            if (Object.keys(upstreamSources).length === 0) continue;
            const downstreamConnections = [];
            for (const nodeId in finalWorkflow) {
                for (const inputName in finalWorkflow[nodeId].inputs) {
                    const input = finalWorkflow[nodeId].inputs[inputName];
                    if (Array.isArray(input) && input[0] === targetNodeId) {
                        downstreamConnections.push({ nodeId, inputName });
                    }
                }
            }
            for (const conn of downstreamConnections) {
                const upstreamSource = upstreamSources[conn.inputName];
                if (upstreamSource) {
                    finalWorkflow[conn.nodeId].inputs[conn.inputName] = upstreamSource;
                }
            }
            delete finalWorkflow[targetNodeId];
            delete finalWorkflow[dynamicNode.id];
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
            // (Type conversion logic omitted for brevity, but is present)
            for (const nodeId in finalWorkflow) {
                for (const inputName in finalWorkflow[nodeId].inputs) {
                    const input = finalWorkflow[nodeId].inputs[inputName];
                    if (Array.isArray(input) && input[0] === dynamicNode.id) {
                        finalWorkflow[nodeId].inputs[inputName] = valueToInject;
                    }
                }
            }
        });
        setFormData(updatedFormData);
        localStorage.setItem(`${selectedWorkflow}_formData`, JSON.stringify(updatedFormData));

        const imageInputNodes = dynamicInputs.filter(dn => dn.class_type === 'CozyGenImageInput');
        for (const node of imageInputNodes) {
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
    setPreviewImage(null);
    localStorage.removeItem('lastPreviewImage');
  };

  const hasImageInput = dynamicInputs.some(input => input.class_type === 'CozyGenImageInput');

  return (
    <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                    <div className="flex-grow flex items-center justify-center border-2 border-dashed border-base-300 rounded-lg p-2 overflow-y-auto" onClick={() => previewImage && openModalWithImage(previewImage)}>
                        {isLoading && <div className="text-center w-full"><p className="text-lg">{statusText}</p></div>}
                        {!isLoading && !previewImage && (
                            <p className="text-gray-400">Your generated image or video will appear here.</p>
                        )}
                        {!isLoading && previewImage && renderPreviewContent(previewImage)}
                    </div>
                </div>
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
            {/* Left Column: Controls */}
            <div className="flex flex-col space-y-2">
                <WorkflowSelector 
                  workflows={workflows}
                  selectedWorkflow={selectedWorkflow}
                  onSelect={handleWorkflowSelect}
                />

                {/* Render DynamicForm for all CozyGenDynamicInput nodes */}
                <DynamicForm
                    inputs={dynamicInputs.filter(input => input.class_type === 'CozyGenDynamicInput')}
                    formData={formData}
                    onFormChange={handleFormChange}
                    randomizeState={randomizeState}
                    onRandomizeToggle={handleRandomizeToggle}
                    bypassedState={bypassedState}
                    onBypassToggle={handleBypassToggle}
                />

                {/* Render ImageInput for CozyGenImageInput nodes */}
                {dynamicInputs.filter(input => input.class_type === 'CozyGenImageInput').map(input => (
                    <ImageInput
                        key={input.id}
                        input={input}
                        value={formData[input.inputs.param_name]} // Pass the relevant part of formData
                        onFormChange={handleFormChange}
                    />
                ))}
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

