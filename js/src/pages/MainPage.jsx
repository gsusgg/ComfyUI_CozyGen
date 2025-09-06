import React, { useState, useEffect, useRef } from 'react';
import WorkflowSelector from '../components/WorkflowSelector';
import DynamicForm from '../components/DynamicForm';
import { getWorkflows, getWorkflow, queuePrompt, getChoices } from '../api';
import Modal from 'react-modal';

// Modal styles (copied from Gallery.jsx for consistency)
const customStyles = {
  content: {
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    marginRight: '-50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: '#2D3748', // base-200
    border: 'none',
    borderRadius: '8px',
    maxWidth: '90vw',
    maxHeight: '90vh',
    padding: '2rem'
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)'
  }
};

Modal.setAppElement('#root');

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
  const [previewImage, setPreviewImage] = useState(localStorage.getItem('lastPreviewImage') || null);
  const [isLoading, setIsLoading] = useState(false);
  const websocketRef = useRef(null);
  const [progressValue, setProgressValue] = useState(0);
  const [progressMax, setProgressMax] = useState(0);
  const [modalIsOpen, setModalIsOpen] = useState(false);

  // --- WebSocket Connection ---
  useEffect(() => {
    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const host = window.location.host;
      const wsUrl = `${protocol}://${host}/ws`;

      websocketRef.current = new WebSocket(wsUrl);

      websocketRef.current.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'cozygen_image_ready') {
          if (msg.data.status === 'image_generated') {
            setPreviewImage(msg.data.image_url);
            localStorage.setItem('lastPreviewImage', msg.data.image_url);
          } else if (msg.data.status === 'no_new_image') {
            // Do not update previewImage, keep the old one or clear if desired
            // For now, just clear loading state
          }
          setIsLoading(false);
          setProgressValue(0); // Reset progress
          setProgressMax(0);
        } else if (msg.type === 'progress') {
          setProgressValue(msg.data.value);
          setProgressMax(msg.data.max);
        } else if (msg.type === 'cozygen_prompt_completed') {
          setIsLoading(false);
          setProgressValue(0); // Reset progress
          setProgressMax(0);
        }
      };

      websocketRef.current.onclose = () => {
        setTimeout(connectWebSocket, 1000); // Attempt to reconnect every second
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

        const inputs = findNodesByType(data, 'CozyGenDynamicInput');
        inputs.sort((a, b) => (a.inputs['priority'] || 0) - (b.inputs['priority'] || 0));

        // Fetch choices for dropdowns
        const inputsWithChoices = await Promise.all(inputs.map(async (input) => {
            if (input.inputs['param_type'] === 'DROPDOWN') {
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
                let defaultValue = input.inputs['default_value'];
                // Convert default value to correct type if necessary
                if (input.inputs['param_type'] === 'INT') {
                    defaultValue = parseInt(defaultValue);
                } else if (input.inputs['param_type'] === 'FLOAT') {
                    defaultValue = parseFloat(defaultValue);
                } else if (input.inputs['param_type'] === 'BOOLEAN') {
                    defaultValue = String(defaultValue).toLowerCase() === 'true';
                }
                initialFormData[param_name] = defaultValue;
            } else {
                initialFormData[param_name] = savedFormData[param_name];
            }
        });
        setFormData(initialFormData);

        const savedRandomizeState = JSON.parse(localStorage.getItem(`${selectedWorkflow}_randomizeState`)) || {};
        setRandomizeState(savedRandomizeState);

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

  const handleGenerate = async () => {
    if (!workflowData) return;
    setIsLoading(true);
    setPreviewImage(null);

    let finalWorkflow = JSON.parse(JSON.stringify(workflowData));

    // Add a unique ID to the workflow to prevent ComfyUI from getting stuck on identical prompts
    const uniqueId = Date.now(); // Using a timestamp as a unique ID

    // Find the CozyGenOutput node and inject the unique ID into its extra_pnginfo
    for (const nodeId in finalWorkflow) {
        const node = finalWorkflow[nodeId];
        if (node.class_type === 'CozyGenOutput') {
            if (!node.inputs.extra_pnginfo) {
                node.inputs.extra_pnginfo = {};
            }
            node.inputs.extra_pnginfo.cozygen_unique_id = uniqueId;
            break; // Assuming only one CozyGenOutput node
        }
    }

    // Inject the dynamic values into the workflow
    dynamicInputs.forEach(dynamicNode => {
        const param_name = dynamicNode.inputs['param_name'];
        const isRandom = randomizeState[param_name];
        let valueToInject;

        if (isRandom) {
            const min = dynamicNode.inputs['min_value'] || 0;
            const max = dynamicNode.inputs['max_value'] || 1000000;
            const isFloat = dynamicNode.inputs['param_type'] === 'FLOAT';
            if (isFloat) {
                valueToInject = Math.random() * (max - min) + min;
            } else {
                valueToInject = Math.floor(Math.random() * (max - min + 1)) + min;
            }
        } else {
            valueToInject = formData[param_name];
        }

        // Iterate through all nodes in the workflow
        for (const nodeId in finalWorkflow) {
            const node = finalWorkflow[nodeId];
            // Iterate through all inputs of the current node
            for (const inputName in node.inputs) {
                const inputValue = node.inputs[inputName];
                // Check if the input is a link array and if it links to the current dynamicNode
                if (Array.isArray(inputValue) && inputValue[0] == dynamicNode.id) {
                    // Replace the link with the actual value
                    node.inputs[inputName] = valueToInject;
                }
            }
        }
    });

    try {
        await queuePrompt({ prompt: finalWorkflow });
    } catch (error) {
        console.error(error);
        setIsLoading(false);
    }
  };

  const handleClearPreview = () => {
    setPreviewImage(null);
    localStorage.removeItem('lastPreviewImage');
  };

  return (
    <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Right Column: Preview & Generate Button */}
            <div className="flex flex-col space-y-6">
                <div className="bg-base-200 shadow-lg rounded-lg p-4 min-h-[400px] lg:min-h-[500px] flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-white">Preview</h2>
                        <button 
                            onClick={handleClearPreview}
                            className="px-3 py-1 bg-base-300 text-gray-300 rounded-md text-sm hover:bg-base-300/70 transition-colors"
                        >
                            Clear
                        </button>
                    </div>
                    <div className="flex-grow flex items-center justify-center border-2 border-dashed border-base-300 rounded-lg">
                        {isLoading && <div className="text-center"><p className="text-lg">Generating...</p></div>} 
                        {previewImage && !isLoading && (
                            <img
                                src={previewImage}
                                alt="Generated preview"
                                className="max-w-full max-h-full object-contain rounded-lg cursor-pointer"
                                onClick={() => setModalIsOpen(true)}
                            />
                        )} 
                        {!previewImage && !isLoading && (
                            <p className="text-gray-400">Your generated image will appear here.</p>
                        )}
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
            <div className="flex flex-col space-y-6">
                <WorkflowSelector 
                  workflows={workflows}
                  selectedWorkflow={selectedWorkflow}
                  onSelect={handleWorkflowSelect}
                />
                <DynamicForm 
                  inputs={dynamicInputs}
                  formData={formData}
                  onFormChange={handleFormChange}
                  randomizeState={randomizeState}
                  onRandomizeToggle={handleRandomizeToggle}
                />
            </div>
        </div>

        {/* Image Preview Modal */}
        {previewImage && (
            <Modal
                isOpen={modalIsOpen}
                onRequestClose={() => setModalIsOpen(false)}
                style={customStyles}
                contentLabel="Image Preview"
            >
                <div className="flex flex-col items-center justify-center h-full">
                    <img src={previewImage} alt="Generated preview" className="max-w-full max-h-[80vh] object-contain rounded-lg" />
                    <button 
                        onClick={() => setModalIsOpen(false)}
                        className="mt-4 px-4 py-2 bg-accent text-white rounded-md hover:bg-accent-focus transition-colors"
                    >
                        Close
                    </button>
                </div>
            </Modal>
        )}
    </div>
  );
}
export default App;