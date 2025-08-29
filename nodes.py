import os
import json
import torch
import numpy as np
from PIL import Image

import folder_paths
from nodes import SaveImage
import server # Import server
import asyncio # Import asyncio
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

    def get_dynamic_value(self, param_name, priority, param_type, default_value, add_randomize_toggle=False, min_value=0.0, max_value=1.0, choices="", multiline=False, step=None):
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

        if results and 'ui' in results and 'images' in results['ui'] and results['ui']['images']:
            saved_image = results['ui']['images'][0]
            saved_filename = saved_image['filename']
            subfolder = saved_image['subfolder']
            saved_type = saved_image['type']

            # Construct the URL for the image
            image_url = f"/view?filename={saved_filename}&subfolder={subfolder}&type={saved_type}"
            
            # Send custom WebSocket message
            message = {
                "type": "cozygen_image_ready",
                "data": {
                    "image_url": image_url,
                    "filename": saved_filename,
                    "subfolder": subfolder,
                    "type": saved_type
                }
            }
            
            # Get the PromptServer instance and send the message
            server_instance = server.PromptServer.instance
            if server_instance:
                server_instance.send_sync("cozygen_image_ready", message["data"])
                print(f"CozyGen: Sent custom WebSocket message: {message}")

            
        
        return results

NODE_CLASS_MAPPINGS = {
    "CozyGenOutput": CozyGenOutput,
    "CozyGenDynamicInput": CozyGenDynamicInput, # Added new node
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "CozyGenOutput": "CozyGen Output",
    "CozyGenDynamicInput": "CozyGen Dynamic Input", # Added new node
}