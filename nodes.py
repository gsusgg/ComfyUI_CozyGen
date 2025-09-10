import os
import json
import torch
import numpy as np
from PIL import Image, ImageOps
from PIL.PngImagePlugin import PngInfo
import base64 # New import
import io # New import

import folder_paths
from nodes import SaveImage
import server # Import server
import asyncio # Import Import asyncio
from comfy.comfy_types import node_typing

class _CozyGenDynamicTypes(str):
    basic_types = node_typing.IO.PRIMITIVE.split(",")

    def __eq__(self, other):
        return other in self.basic_types or isinstance(other, (list, _CozyGenDynamicTypes))

    def __ne__(self, other):
        return not self.__eq__(other)

CozyGenDynamicTypes = _CozyGenDynamicTypes("COZYGEN_DYNAMIC_TYPE")


class CozyGenDynamicInput:
    _NODE_CLASS_NAME = "CozyGenDynamicInput" # Link to custom JavaScript

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "param_name": ("STRING", {"default": "Dynamic Parameter"}),
                "priority": ("INT", {"default": 0}),
                "param_type": (["STRING", "INT", "FLOAT", "BOOLEAN", "DROPDOWN"], {"default": "STRING"}),
                "default_value": ("STRING", {"default": ""}),
            },
            "optional": {
                "add_randomize_toggle": ("BOOLEAN", {"default": False}),
                "choice_type": ("STRING", {"default": ""}),
                "display_bypass": ("BOOLEAN", {"default": False}),
            },
            "hidden": {
                "choices": ("STRING", {"default": ""}), # Used by JS for dropdowns
                "multiline": ("BOOLEAN", {"default": False}), # Used by JS for strings
                "min_value": ("FLOAT", {"default": 0.0}), # Used by JS for numbers
                "max_value": ("FLOAT", {"default": 1.0}), # Used by JS for numbers
                "step": ("FLOAT", {"default": 0.0}), # Used by JS for numbers
            }
        }

    RETURN_TYPES = (node_typing.IO.ANY,) # Can return any type
    FUNCTION = "get_dynamic_value"

    CATEGORY = "CozyGen"

    def get_dynamic_value(self, param_name, priority, param_type, default_value, add_randomize_toggle=False, choice_type="", min_value=0.0, max_value=1.0, choices="", multiline=False, step=None, display_bypass=False):
        # Convert default_value based on param_type
        if param_type == "INT":
            try:
                value = int(default_value)
            except (ValueError, TypeError):
                value = 0  # Default to 0 if conversion fails
        elif param_type == "FLOAT":
            try:
                value = float(default_value)
            except (ValueError, TypeError):
                value = 0.0  # Default to 0.0 if conversion fails
        elif param_type == "BOOLEAN":
            value = str(default_value).lower() == "true"
        elif param_type == "DROPDOWN":
            value = default_value # For dropdowns, default_value is already the selected string
        else:  # STRING or any other type
            value = default_value
        return (value, )


class CozyGenImageInput:
    @classmethod
    def INPUT_TYPES(s):
        # This input now correctly accepts a STRING, which will be our Base64 data.
        return {
            "required": {
                "param_name": ("STRING", {"default": "Image Input"}),
                "base64_image": ("STRING", {"multiline": True, "default": ""}),
            }
        }

    # The return types are now the standard IMAGE and MASK for ComfyUI image loaders.
    RETURN_TYPES = ("IMAGE", "MASK")
    FUNCTION = "load_image"
    CATEGORY = "CozyGen"

    def load_image(self, param_name, base64_image):
        from io import BytesIO # Temporary workaround for io NameError
        # This function contains the logic for decoding the string and preparing the image tensor.
        
        # Remove the data URL prefix if it exists (e.g., "data:image/png;base64,")
        if "," in base64_image:
            base64_image = base64_image.split(',')[1]

        # Decode the Base64 string into bytes
        img_data = base64.b64decode(base64_image)
        
        # Open the image data using the Pillow library
        img = Image.open(io.BytesIO(img_data))
        
        # Convert the image to a NumPy array and normalize its values to the 0.0-1.0 range
        image_np = np.array(img).astype(np.float32) / 255.0
        
        # Convert the NumPy array to a PyTorch tensor and add a batch dimension
        image_tensor = torch.from_numpy(image_np)[None,]

        # Handle images with an alpha channel (transparency) to create a mask
        if 'A' in img.getbands():
            mask = image_tensor[:, :, :, 3]
            image = image_tensor[:, :, :, :3] # Keep only the RGB channels for the image
        else:
            # If no alpha channel, the mask is all white (fully opaque)
            mask = torch.ones_like(image_tensor[:, :, :, 0])
            image = image_tensor

        return (image, mask)


class CozyGenOutput(SaveImage):
    def __init__(self):
        super().__init__()
        self.output_dir = folder_paths.get_output_directory()

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": ("IMAGE", ),
            },
            "optional": {
                "filename_prefix": ("STRING", {"default": "CozyGen/output"}),
            },
            "hidden": {
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO"
            },
        }

    FUNCTION = "save_images"
    CATEGORY = "CozyGen"

    def save_images(self, images, filename_prefix="CozyGen/output", prompt=None, extra_pnginfo=None):
        results = super().save_images(images, filename_prefix, prompt, extra_pnginfo)

        # Check if images were actually saved
        if results and 'ui' in results and 'images' in results['ui'] and results['ui']['images']:
            server_instance = server.PromptServer.instance
            if server_instance:
                for saved_image in results['ui']['images']:
                    saved_filename = saved_image['filename']
                    subfolder = saved_image['subfolder']
                    saved_type = saved_image['type']

                    # Construct the URL for the image
                    image_url = f"/view?filename={saved_filename}&subfolder={subfolder}&type={saved_type}"
                    
                    message_data = {
                        "status": "image_generated",
                        "image_url": image_url,
                        "filename": saved_filename,
                        "subfolder": subfolder,
                        "type": saved_type
                    }
                    server_instance.send_sync("cozygen_image_ready", message_data)
                    print(f"CozyGen: Sent custom WebSocket message: {{'type': 'cozygen_image_ready', 'data': {message_data}}}")
        else:
            # No new image was generated (e.g., duplicate prompt)
            message_data = {
                "status": "no_new_image"
            }
            server_instance = server.PromptServer.instance
            if server_instance:
                server_instance.send_sync("cozygen_image_ready", message_data)
                print(f"CozyGen: Sent custom WebSocket message: {{'type': 'cozygen_image_ready', 'data': {message_data}}}")

            
        
        return results

NODE_CLASS_MAPPINGS = {
    "CozyGenOutput": CozyGenOutput,
    "CozyGenDynamicInput": CozyGenDynamicInput,
    "CozyGenImageInput": CozyGenImageInput,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "CozyGenOutput": "CozyGen Output",
    "CozyGenDynamicInput": "CozyGen Dynamic Input",
    "CozyGenImageInput": "CozyGen Image Input",
}