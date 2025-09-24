# CozyGen: A Mobile-Friendly ComfyUI Controller

![ComfyUI Custom Node](https://img.shields.io/badge/ComfyUI-Custom%20Node-blue.svg)

## DISCLAIMER

This project was 100% "vibe-coded" using Gemini 2.5 Pro/Flash. I dont code, but wanted to share a working LLM assisted projected. Everything AFTER this disclaimer section is 99% made by an LLM. I just wanted to make dumb cat pictures with my desktop ComfyUI from my phone, so now this exists. Thanks to @acly and the comfyui-tooling-nodes for the inspiration.

Known Issues:

*  The default_choice option on the "Choice Input Node" does not work, but you will only need to select it the first time in the front end and it will save in your browser cache. Just make sure the choice_type is correct.
*  If the front end web page is not "active" when generation completes, the preview will not display. The image will be in the gallery.

Changelog:
*  9/24/2025 - Update 2

    * Added mp4/gif output support with the "CozyGen Video Output" node
    * Broke out the Dynamic input node to reduce complexity. DynamicInput still functions, but these can be used if you want to have values saved when loading the workflow again in ComfyUI. Choice options are still weird, you need to specify the folder the model is in and the front end will fill the drop down control with those models. 4 new nodes:
         * CozyGen Int Input
         * CozyGen Float Input
         * CozyGen String Input
         * CozyGen Choice Input
    * Improved Generate page with a static generate button and styling tweaks
    * Improved choice bypass option, allowing you to bypass lora loaders from the front end. You can now bypass loras in a chain of loras as seen in the Flux example workflow.
	* Generating a batch greater than 1 now displays all generated images in the image preview
	
*  9/11/2025 - Update 1
	*NOTE* This update will require you to remake workflows if you already had some. If you run into weird issues, try a complete reinstall if you are upgrading.

	*   Added image 2 image support with the "Cozy Gen Image Input" Node
    *   "Smart Resize" for image upload that automatically resizes to within standard 1024*1024 ranges while maintaining aspect ratio.
	*   Added more robust support for dropdown choices, with option to specify model subfolder with "choice_type" option.   
	*   Improved gallery view and image overlay modals, with zoom/pinch and pan controls.   
	*   Added gallery pagination to reduce load of large gallery folders.
	*   Added bypass option to dropdown connections. This is mainly intended for loras so you can add multiple to the workflow, but choose which to use from the front end.
	*   General improvements (Layout, background functions, etc.)
	*   The other stuff that I forgot about but is in here.
		
*  8/29/2025 - Initial release

## ✨ Overview

CozyGen is a custom node for ComfyUI that provides a sleek, mobile-friendly web interface to remotely control your ComfyUI server. Designed for ease of use, it allows you to load pre-defined workflows, dynamically adjust parameters, and generate stunning images from any device with a web browser. Say goodbye to the desktop interface and hello to on-the-go creativity!

## 🚀 Features

*   **Modern & Intuitive UI:** A beautiful, mobile-first interface built with React, Vite, and Tailwind CSS, featuring a stylish dark theme.
*   **Dynamic Controls:** The user interface automatically generates input controls (text fields, sliders, dropdowns, toggles) based on the `CozyGenDynamicInput` nodes in your ComfyUI workflows.
*   **Priority Sorting:** A "priority" field that determines how the webpage is ordered. A 0 priority will push the field towards the top of the page.
*   **Real-time Previews:** Get instant visual feedback with real-time previews of your generated images directly in the web interface.
*   **Persistent Sessions:** Your selected workflow, input values, and even the last generated image are remembered across browser sessions.
*   **Image Gallery:** Browse, view, and manage all your previously generated images, complete with extracted prompt and seed metadata.
*   **Randomization:** Easily randomize numerical inputs like seeds with a dedicated toggle.
*   **Seamless Integration:** Works directly with your existing ComfyUI setup, leveraging its core functionalities.

## 📸 Screenshots / Demos
Mobile-first design:

<p align="center">
  <img width="744" height="1267" alt="Image" src="https://github.com/user-attachments/assets/d0d48c31-780f-4962-a2ce-9fae0ca40bf6" />
</p>

Adapts to browser size:

<p align="center">
  <img width="1514" height="865" alt="Image" src="https://github.com/user-attachments/assets/77523bda-e45f-4d95-a7e1-c844bb4eb14f" />
</p>

Custom Node adapts to the string/int/float/dropdown they are connected to:
<p align="center">
<img width="1745" height="920" alt="Image" src="https://github.com/user-attachments/assets/52d00ee5-42ef-4a5e-a39e-52b6ff80f852" />
</p>

A gallery tab that can navigate your ComfyUI output folder. Click on the path in the top left to go back to the base output folder.
<p align="center">
<img width="1532" height="692" alt="Image" src="https://github.com/user-attachments/assets/1951a027-bf49-48f2-b1d5-e9e85c3351a8" />
</p>

## 📦 Installation

Node can be installed with the ComfyUI Manager. Search for "CozyGen" to install.

Follow these steps to get CozyGen up and running with your ComfyUI instance.

### 1. Clone the Repository

Navigate to your ComfyUI `custom_nodes` directory and clone this repository:

```bash
cd /path/to/your/ComfyUI/custom_nodes
git clone https://github.com/gsusgg/ComfyUI_CozyGen.git
```

### 2. Install Python Dependencies

(This node only requires aiohttp, which should already be installed with ComfyUI.)

CozyGen requires the aiohttp Python package. Navigate into the `ComfyUI_CozyGen` directory and install them using `pip`.

```bash
cd custom_nodes/ComfyUI_CozyGen
pip install -r requirements.txt
```

### 3. Restart ComfyUI

After completing the above steps, restart your ComfyUI server to load the new custom node and its web interface.

### 4. (Optional) ComfyUI --listen

If you want to use this as a remote to your machine running ComfyUI on the local network, add the "--listen" flag to your ComfyUI startup.

## 🚀 Usage

### 1. Prepare Your Workflow

In ComfyUI, create or open a workflow that you want to control remotely. For each parameter you wish to expose to the web UI:

*   Add a `CozyGenDynamicInput` node and connect its output to the desired input on another node.
*   Configure the `CozyGenDynamicInput` node's properties (e.g., `param_name`, `param_type`, `default_value`, `min_value`, `max_value`, `add_randomize_toggle`).
*   Add a `CozyGenOutput` node at the end of your workflow to save the generated image and send real-time previews to the web UI.
*   *IMPORTANT* When exporting your workflow, export with API into the `ComfyUI_CozyGen/workflows/` directory.

*   Some dropdown menus may not automatically populate if the model folder is not a default. Use the choice_type widget to point to the correct models subfolder using its name (ex: loras)

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

I do not plan to update this forever, but wanted to share what I have. Feel free to take it and update it on your own!

## 📄 License

This project is licensed under the GPL-3.0 license - see the [LICENSE](LICENSE) file for details.