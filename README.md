# CozyGen: A Mobile-Friendly ComfyUI Controller

![ComfyUI Custom Node](https://img.shields.io/badge/ComfyUI-Custom%20Node-blue.svg)

## ✨ Overview

CozyGen is a custom node for ComfyUI that provides a sleek, mobile-friendly web interface to remotely control your ComfyUI server. Designed for ease of use, it allows you to load pre-defined workflows, dynamically adjust parameters, and generate stunning images from any device with a web browser. Say goodbye to the desktop interface and hello to on-the-go creativity!

## 🚀 Features

*   **Modern & Intuitive UI:** A beautiful, mobile-first interface built with React, Vite, and Tailwind CSS, featuring a stylish dark theme.
*   **Dynamic Controls:** The user interface automatically generates input controls (text fields, sliders, dropdowns, toggles) based on the `CozyGenDynamicInput` nodes in your ComfyUI workflows.
*   **Real-time Previews:** Get instant visual feedback with real-time previews of your generated images directly in the web interface.
*   **Persistent Sessions:** Your selected workflow, input values, and even the last generated image are remembered across browser sessions.
*   **Image Gallery:** Browse, view, and manage all your previously generated images, complete with extracted prompt and seed metadata.
*   **Randomization:** Easily randomize numerical inputs like seeds with a dedicated toggle.
*   **Seamless Integration:** Works directly with your existing ComfyUI setup, leveraging its core functionalities.

## 📸 Screenshots / Demos

*(Add screenshots or a GIF here to showcase the UI and features)*

## 📦 Installation

Follow these steps to get CozyGen up and running with your ComfyUI instance.

### 1. Place the Custom Node

Navigate to your ComfyUI installation directory and place the `ComfyUI_CozyGen` folder inside the `custom_nodes` directory.

```bash
cd /path/to/your/ComfyUI
mv /path/to/downloaded/ComfyUI_CozyGen custom_nodes/
```

### 2. Install Python Dependencies

CozyGen requires a few Python packages. Navigate into the `ComfyUI_CozyGen` directory and install them using `pip`.

```bash
cd custom_nodes/ComfyUI_CozyGen
pip install -r requirements.txt
```

### 3. Restart ComfyUI

After completing the above steps, restart your ComfyUI server to load the new custom node and its web interface.

## 🚀 Usage

### 1. Prepare Your Workflow

In ComfyUI, create or open a workflow that you want to control remotely. For each parameter you wish to expose to the web UI:

*   Add a `CozyGenDynamicInput` node and connect its output to the desired input on another node.
*   Configure the `CozyGenDynamicInput` node's properties (e.g., `param_name`, `param_type`, `default_value`, `min_value`, `max_value`, `add_randomize_toggle`).
*   Add a `CozyGenOutput` node at the end of your workflow to save the generated image and send real-time previews to the web UI.
*   Save your workflow as a JSON file in the `ComfyUI_CozyGen/workflows/` directory.

### 2. Access the Web UI

Open your web browser and navigate to:

```
http://<your-comfyui-ip>:8188/cozygen
```

(Replace `<your-comfyui-ip>` with the IP address or hostname where your ComfyUI server is running, e.g., `127.0.0.1` for local access).

### 3. Generate Images

1.  Select your prepared workflow from the dropdown menu.
2.  Adjust the dynamically generated parameters as needed. Your settings will be saved automatically.
3.  Click the "Generate" button.
4.  The generated image will appear in the preview area. You can click it to expand it or use the "Clear" button to reset the panel.
5.  Click the "Gallery" link in the header to browse all your generated images.

## 🤝 Contributing

Contributions are welcome! If you have ideas for new features, improvements, or bug fixes, please open an issue or submit a pull request on the GitHub repository.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
