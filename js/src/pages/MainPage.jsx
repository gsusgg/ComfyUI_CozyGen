import React, { useState, useEffect, useRef } from 'react';
import WorkflowSelector from '../components/WorkflowSelector';
import DynamicForm from '../components/DynamicForm';
import ImageInput from '../components/ImageInput'; // Import ImageInput
import { getWorkflows, getWorkflow, queuePrompt, getChoices } from '../api';
import Modal from 'react-modal';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

// Modal styles (copied from Gallery.jsx for consistency)
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
        const msg = JSON.parse(event.data);
        if (msg.type === 'cozygen_image_ready') {
          if (msg.data.status === 'image_generated') {
            setPreviewImage(msg.data.image_url);
            localStorage.setItem('lastPreviewImage', msg.data.image_url);
          } else if (msg.data.status === 'no_new_image') {
            // Do not update previewImage, keep the old one or clear if desired
            // For now, just just clear loading state
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
    setPreviewImage(null);

    let finalWorkflow = JSON.parse(JSON.stringify(workflowData));

    // First, ensure all CozyGenImageInput nodes in finalWorkflow have a param_name.
    for (const nodeId in finalWorkflow) {
        const node = finalWorkflow[nodeId];
        if (node.class_type === 'CozyGenImageInput') {
            const dynamicInput = dynamicInputs.find(input => input.id === nodeId);
            if (dynamicInput) {
                node.inputs.param_name = dynamicInput.inputs.param_name;
            }
        }
    }

    // Process bypassed nodes
    for (const dynamicNode of dynamicInputs) {
        const param_name = dynamicNode.inputs['param_name'];
        const isBypassed = bypassedState[param_name];

        if (isBypassed && dynamicNode.class_type === 'CozyGenDynamicInput') {
            // Find the node that this CozyGenDynamicInput is connected to
            let targetNodeId = null;
            let targetInputName = null;

            for (const nodeId in finalWorkflow) {
                const node = finalWorkflow[nodeId];
                for (const inputName in node.inputs) {
                    const inputValue = node.inputs[inputName];
                    if (Array.isArray(inputValue) && inputValue[0] == dynamicNode.id) {
                        targetNodeId = nodeId;
                        targetInputName = inputName;
                        break;
                    }
                }
                if (targetNodeId) break;
            }

            if (targetNodeId) {
                const targetNode = finalWorkflow[targetNodeId];
                console.log(`CozyGen: Bypassing node ${targetNodeId} (type: ${targetNode.class_type}) connected to dynamic input ${param_name}`);

                // --- Rewiring Logic ---
                // This is the complex part. We need to find all inputs to the targetNode
                // and all nodes that take output from the targetNode, then reconnect them.

                // 1. Identify upstream connections to the targetNode
                const upstreamConnections = [];
                for (const inputKey in targetNode.inputs) {
                    const inputVal = targetNode.inputs[inputKey];
                    if (Array.isArray(inputVal) && inputVal.length === 2) {
                        upstreamConnections.push({
                            sourceNodeId: inputVal[0],
                            sourceOutputIndex: inputVal[1],
                            targetInputKey: inputKey // The input name on the target node
                        });
                    }
                }

                // 2. Identify downstream connections from the targetNode
                const downstreamConnections = [];
                for (const nodeId in finalWorkflow) {
                    if (nodeId === targetNodeId) continue; // Skip the target node itself
                    const node = finalWorkflow[nodeId];
                    for (const inputKey in node.inputs) {
                        const inputVal = node.inputs[inputKey];
                        if (Array.isArray(inputVal) && inputVal.length === 2 && inputVal[0] == targetNodeId) {
                            downstreamConnections.push({
                                targetNodeId: nodeId,
                                targetInputKey: inputKey,
                                sourceOutputIndex: inputVal[1] // The output index from the target node
                            });
                        }
                    }
                }

                // Special handling for lora_loader as per example
                if (targetNode.class_type === 'LoraLoader') {
                    // Assuming lora_loader has 'model' and 'clip' inputs and outputs
                    // And the bypass means we want to connect the upstream 'model' to downstream 'model'
                    // and upstream 'clip' to downstream 'clip'.

                    let upstreamModelConnection = null;
                    let upstreamClipConnection = null;

                    for (const conn of upstreamConnections) {
                        if (conn.targetInputKey === 'model') {
                            upstreamModelConnection = conn;
                        } else if (conn.targetInputKey === 'clip') {
                            upstreamClipConnection = conn;
                        }
                    }

                    for (const conn of downstreamConnections) {
                        // Find the corresponding input on the downstream node
                        // This assumes the output from lora_loader is also 'model' or 'clip'
                        // and the downstream node expects an input of the same type.
                        if (conn.sourceOutputIndex === 0 && upstreamModelConnection) { // Assuming model is output 0
                            finalWorkflow[conn.targetNodeId].inputs[conn.targetInputKey] = [
                                upstreamModelConnection.sourceNodeId,
                                upstreamModelConnection.sourceOutputIndex
                            ];
                            console.log(`CozyGen: Rewired model from ${upstreamModelConnection.sourceNodeId} to ${conn.targetNodeId}`);
                        } else if (conn.sourceOutputIndex === 1 && upstreamClipConnection) { // Assuming clip is output 1
                            finalWorkflow[conn.targetNodeId].inputs[conn.targetInputKey] = [
                                upstreamClipConnection.sourceNodeId,
                                upstreamClipConnection.sourceOutputIndex
                            ];
                            console.log(`CozyGen: Rewired clip from ${upstreamClipConnection.sourceNodeId} to ${conn.targetNodeId}`);
                        }
                    }
                } else {
                    // Generic rewiring for other nodes (less robust, might need refinement)
                    // This assumes a single input/output flow or that all inputs/outputs
                    // can be directly mapped.
                    if (upstreamConnections.length === 1 && downstreamConnections.length === 1) {
                        const upstream = upstreamConnections[0];
                        const downstream = downstreamConnections[0];

                        finalWorkflow[downstream.targetNodeId].inputs[downstream.targetInputKey] = [
                            upstream.sourceNodeId,
                            upstream.sourceOutputIndex
                        ];
                        console.log(`CozyGen: Generic rewiring from ${upstream.sourceNodeId} to ${downstream.targetNodeId}`);
                    } else {
                        console.warn(`CozyGen: Skipping generic rewiring for node ${targetNodeId} due to complex connections.`);
                    }
                }

                // 3. Remove the bypassed node
                delete finalWorkflow[targetNodeId];
                console.log(`CozyGen: Removed bypassed node ${targetNodeId}`);
            }
        }
    }

    // Note: ComfyUI's API handles link removal automatically when nodes are deleted.
    // We don't need to explicitly manage a `finalWorkflow.links` object here
    // because the workflowData we receive is a flat node dictionary, not the full API JSON structure.
    // The links are implicitly handled by the input arrays.

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

    // Inject image filenames into all CozyGenImageInput nodes
    const imageInputNodesInWorkflow = Object.values(finalWorkflow).filter(
        node => node.class_type === 'CozyGenImageInput'
    );

    if (imageInputNodesInWorkflow.length > 0) {
        for (const node of imageInputNodesInWorkflow) {
            const param_name = node.inputs.param_name; // Now it should be present
            const image_filename = formData[param_name];

            if (!image_filename) {
                alert(`Please upload an image for "${param_name}" before generating.`);
                setIsLoading(false);
                return;
            }
            node.inputs.image_filename = image_filename;
        }
    }

    let updatedFormData = { ...formData }; // Start with current formData

    // Inject the dynamic values into the workflow
    dynamicInputs.forEach(dynamicNode => {
        console.log("Processing dynamicNode:", dynamicNode);
        const param_name = dynamicNode.inputs['param_name'];
        let valueToInject;

        // Skip CozyGenImageInput as its handling is now separate
        if (dynamicNode.class_type === 'CozyGenImageInput') {
            return;
        }

        const isRandom = randomizeState[param_name];

        if (isRandom) {
            const min = dynamicNode.inputs['min_value'] || 0;
            const max = dynamicNode.inputs['max_value'] || 1000000;
            const isFloat = dynamicNode.inputs['param_type'] === 'FLOAT';
            if (isFloat) {
                valueToInject = Math.random() * (max - min) + min;
            } else {
                valueToInject = Math.floor(Math.random() * (max - min + 1)) + min;
            }
            updatedFormData[param_name] = valueToInject; // Update the temporary object
        } else {
            valueToInject = formData[param_name];
        }

        // Perform type conversion before injecting the value
        switch (dynamicNode.inputs['param_type']) {
            case 'INT':
                // Ensure value is a string before parsing, and handle empty/null/undefined
                valueToInject = parseInt(String(valueToInject || '0'), 10);
                if (isNaN(valueToInject)) {
                    valueToInject = 0; // Default to 0 if parsing fails
                }
                break;
            case 'FLOAT':
                // Ensure value is a string before parsing, and handle empty/null/undefined
                valueToInject = parseFloat(String(valueToInject || '0'));
                if (isNaN(valueToInject)) {
                    valueToInject = 0.0; // Default to 0.0 if parsing fails
                }
                break;
            case 'BOOLEAN':
                // Convert to boolean explicitly, handling various string representations
                valueToInject = (String(valueToInject).toLowerCase() === 'true' || valueToInject === true);
                break;
            case 'STRING':
            default:
                // Ensure it's always a string for STRING type, even if it's null/undefined
                valueToInject = String(valueToInject || '');
                break;
        }

        // Iterate through all nodes in the workflow
        for (const nodeId in finalWorkflow) {
            const node = finalWorkflow[nodeId];
            // Iterate through all inputs of the current node
            for (const inputName in node.inputs) {
                const inputValue = node.inputs[inputName];
                // Check if the input is a link array and if it links to the current dynamicNode
                if (Array.isArray(inputValue) && String(inputValue[0]) === String(dynamicNode.id)) {
                    console.log(`Replacing link in node ${nodeId}, input ${inputName} with value:`, valueToInject);
                    // Replace the link with the actual value
                    node.inputs[inputName] = valueToInject;
                }
            }
        }
    });

    setFormData(updatedFormData); // Update state once after the loop
    localStorage.setItem(`${selectedWorkflow}_formData`, JSON.stringify(updatedFormData)); // Save to localStorage

    console.log(JSON.stringify(finalWorkflow, null, 2));

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

  const hasImageInput = dynamicInputs.some(input => input.class_type === 'CozyGenImageInput');

  return (
    <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Right Column: Preview & Generate Button */}
            <div className="flex flex-col space-y-4">
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
                    <div className="flex-grow flex items-center justify-center border-2 border-dashed border-base-300 rounded-lg p-4 overflow-y-auto">
                        {isLoading && <div className="text-center w-full"><p className="text-lg">Generating...</p></div>}
                        {!isLoading && !previewImage && (
                            <p className="text-gray-400">Your generated image will appear here.</p>
                        )}
                        {!isLoading && previewImage && (
                            <img
                                src={previewImage}
                                alt="Generated preview"
                                className="max-w-full max-h-full object-contain rounded-lg cursor-pointer"
                                onClick={() => openModalWithImage(previewImage)}
                            />
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
            <div className="flex flex-col space-y-4">
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
                        <TransformWrapper
                            initialScale={1}
                            minScale={0.5}
                            maxScale={5}
                            limitToBounds={false}
                            doubleClick={{ disabled: true }}
                            wheel={true}
                        >
                            <TransformComponent>
                                <img src={selectedPreviewImage} alt="Generated preview" className="max-w-full max-h-full object-contain rounded-lg" />
                            </TransformComponent>
                        </TransformWrapper>
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