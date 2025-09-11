# Technical Documentation: ComfyUI_CozyGen

This document outlines the technical architecture and implementation details of the CozyGen project.

## 1. Technical Architecture

### 1.1 Project Goal

The primary goal of CozyGen is to provide a mobile-friendly web interface for remotely controlling a ComfyUI server. It aims to abstract the complex, node-based graph of ComfyUI into a simple, user-friendly, form-based web interface. This allows users to execute image generation workflows by adjusting simple controls like sliders and text fields, without directly interacting with the underlying node graph.

### 1.2 Core Concept

The system revolves around two custom ComfyUI nodes: `CozyGenDynamicInput` and `CozyGenOutput`.

*   **`CozyGenDynamicInput`**: This node acts as a configurable input for the web UI. Users define parameters (like name, type, default value, min/max) directly on this node within the ComfyUI editor. The node's output is then connected to the desired input of another ComfyUI node (e.g., connecting a `CozyGenDynamicInput` to a KSampler's `seed` input). This connection *is* used for data flow during image generation. The frontend web application reads the properties of these `CozyGenDynamicInput` nodes from the workflow JSON to dynamically render the input forms.

*   **`CozyGenOutput`**: This node is placed at the end of a workflow. It saves the generated image and, crucially, sends real-time updates (including the image URL and metadata) via WebSocket to the connected web UI, enabling live previews.

When the end-user interacts with the web UI and triggers a generation, the frontend constructs a complete workflow JSON (using the values from the dynamic inputs) and submits it to the ComfyUI backend for execution.

### 1.3 Component Breakdown

#### 1.3.1 `nodes.py` - The Backend Nodes

*   **`CozyGenDynamicInput`**:
    *   **Purpose**: Exposes configurable parameters from a ComfyUI workflow to the CozyGen web interface.
    *   **Inputs**: Configured via node properties such as `param_name` (string), `priority` (int), `param_type` (STRING, INT, FLOAT, BOOLEAN, DROPDOWN), `default_value` (string), and optional parameters like `add_randomize_toggle`, `choice_type`, `choices`, `multiline`, `min_value`, `max_value`, and `step`.
    *   **Outputs**: Has a single wildcard (`*`) output that connects to the actual input of other ComfyUI nodes, passing the value determined by the web UI.
    *   **`get_dynamic_value` Method**: Converts the `default_value` (received as a string from the node properties or the web UI) to the appropriate Python type (int, float, boolean, string) based on `param_type`.

*   **`CozyGenImageInput`**:
    *   **Purpose**: Provides a UI element in the frontend for image selection/upload. The actual image data is injected into the workflow JSON by the frontend.
    *   **Inputs**:
        *   `param_name` (string): A name for this image input, used by the frontend to identify and display it.
    *   **Outputs**: Has a single `IMAGE` output. This output provides a placeholder image; the actual image data is handled by the frontend and injected directly into the workflow JSON.
    *   **`load_image` Method**: Returns a blank image as a placeholder. The frontend is responsible for injecting the actual image data into the workflow JSON before it's sent to ComfyUI.

*   **`CozyGenOutput`**:
    *   **Purpose**: The final node in a CozyGen workflow, responsible for saving generated images and sending real-time updates to the web UI.
    *   **Inheritance**: Extends ComfyUI's built-in `SaveImage` node.
    *   **Inputs**: Accepts an `IMAGE` tensor and an optional `filename_prefix`.
    *   **`save_images` Method**: Overrides the parent method to first save the image using the standard ComfyUI mechanism. After successful saving, it constructs an image URL and sends a custom WebSocket message (`cozygen_image_ready`) to the frontend, containing the image URL and other metadata. This facilitates the real-time preview feature.

#### 1.3.2 `js/web/cozygen_dynamic_input.js` - ComfyUI Editor Frontend Integration

This JavaScript file integrates with the ComfyUI editor to enhance the `CozyGenDynamicInput` node's behavior.

*   **`_NODE_CLASS_NAME`**: Links to the `CozyGenDynamicInput` Python node.
*   **Functionality**: This script is primarily responsible for reading the properties defined on the `CozyGenDynamicInput` node within the ComfyUI editor and potentially rendering additional UI elements or modifying existing ones based on these properties (e.g., showing/hiding specific input fields like `min_value`, `max_value` based on `param_type`). It does *not* dynamically clone widgets from other nodes.

#### 1.3.3 `api.py` - The Backend API

This Python file defines the HTTP API endpoints that the CozyGen web frontend interacts with. It uses `aiohttp` for handling web requests.

*   **`/cozygen/hello` (GET)**: A simple endpoint for testing API connectivity.
*   **`/cozygen/gallery` (GET)**: Retrieves a list of image files and directories from the ComfyUI output folder. It includes functionality to extract prompt and seed metadata from PNG files.
*   **`/cozygen/upload_image` (POST)**: Handles the upload of image files from the frontend.
    *   **Purpose**: Allows users to upload images directly to the ComfyUI input directory for use in workflows.
    *   **Inputs**: Expects a multipart form data request with a field named `image` containing the image file.
    *   **Outputs**: Returns a JSON response with the `filename` of the saved image and its `size`.
*   **`/cozygen/workflows` (GET)**: Returns a list of available workflow JSON filenames located in the `ComfyUI_CozyGen/workflows/` directory.
*   **`/cozygen/workflows/{filename}` (GET)**: Fetches the content of a specific workflow JSON file.
*   **`/cozygen/get_choices` (GET)**: Provides dynamic lists of choices (e.g., schedulers, samplers, or model names) that can be used for dropdown inputs in the web UI.

#### 1.3.4 `js/src/api.js` - Frontend API Functions

This JavaScript file contains functions for the frontend to interact with the CozyGen backend API.

*   **`uploadImage(imageFile)`**: Uploads an image file to the backend.
    *   **Purpose**: Sends a selected image file from the user's local machine to the `/cozygen/upload_image` endpoint.
    *   **Parameters**: `imageFile` (File object) - The image file to be uploaded.
    *   **Returns**: A Promise that resolves with the JSON response from the backend, typically containing the filename of the uploaded image.

#### 1.3.5 `js/src/pages/MainPage.jsx` - Main Application Logic

This React component is the main page for the CozyGen web interface, responsible for fetching workflows, managing form data, and handling prompt queuing.

*   **Integration of `CozyGenImageInput`**: The `MainPage.jsx` now recognizes and handles the `CozyGenImageInput` node type.
    *   It uses `findNodesByType` to identify both `CozyGenDynamicInput` and `CozyGenImageInput` nodes in the loaded workflow.
    *   The `useEffect` hook responsible for fetching workflow data now initializes `formData` for `CozyGenImageInput` nodes, setting default values based on the node's properties.
    *   The `handleGenerate` function has been updated to correctly extract the image path (or uploaded filename) from the `formData` for `CozyGenImageInput` nodes and inject it into the workflow JSON sent to the ComfyUI backend.
    *   The rendering logic (`return` statement) has been modified to conditionally render the new `ImageInput` component when a `CozyGenImageInput` node is encountered, passing the necessary props (`input`, `value`, `onFormChange`).
    *   **Image Preview Fix**: The `ImageInput` component's `previewUrl` construction was updated to correctly display uploaded images by removing the erroneous `subfolder=input` parameter from the `/view` endpoint URL. This ensures that images saved to the ComfyUI input directory are correctly displayed in the frontend preview.
    *   **Redundant Image Input Box Removal**: The extra "Image Input" title box that appeared above the actual `ImageInput` component on the generate page was removed. This was a redundant `div` that provided a title, but the `ImageInput` component itself already includes appropriate labeling, leading to a cleaner and less confusing UI.
    *   **Compact Image Input Layout**: The `CozyGenImageInput` control box in the frontend (`ImageInput.jsx`) has been redesigned for a more compact layout. It now features the file browse and smart resize options on the left, and a smaller, inline thumbnail preview of the selected image on the right. This improves the overall UI/UX by reducing the space occupied by the image input.
