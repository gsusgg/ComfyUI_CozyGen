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
                "image_filename": ("STRING", {"default": ""}),
            }
        }

    # The return types are now the standard IMAGE and MASK for ComfyUI image loaders.
    RETURN_TYPES = ("IMAGE", "MASK")
    FUNCTION = "load_image"
    CATEGORY = "CozyGen"

    def load_image(self, param_name, image_filename):
        image_path = folder_paths.get_input_directory() + os.sep + image_filename
        img = Image.open(image_path)
        image_np = np.array(img).astype(np.float32) / 255.0
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


import imageio

class CozyGenVideoOutput:
    def __init__(self):
        self.output_dir = folder_paths.get_output_directory()
        self.type = "output"
        self.prefix_append = ""

    @classmethod
    def INPUT_TYPES(s):
        return {"required": 
                    {"images": ("IMAGE", ),
                     "frame_rate": ("INT", {"default": 8, "min": 1, "max": 24}),
                     "loop_count": ("INT", {"default": 0, "min": 0, "max": 100}),
                     "filename_prefix": ("STRING", {"default": "CozyGen/video"}),
                     "format": (["video/webm", "video/mp4", "image/gif"],),
                     "pingpong": ("BOOLEAN", {"default": False}),
                     },
                "hidden": {"prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO"},
                }

    RETURN_TYPES = ()
    FUNCTION = "save_video"
    OUTPUT_NODE = True

    CATEGORY = "CozyGen"

    def save_video(self, images, frame_rate, loop_count, filename_prefix="CozyGen/video", format="video/webm", pingpong=False, prompt=None, extra_pnginfo=None):
        filename_prefix += self.prefix_append
        full_output_folder, filename, counter, subfolder, filename_prefix = folder_paths.get_save_image_path(filename_prefix, self.output_dir, images[0].shape[1], images[0].shape[0])
        results = list()
        
        if format == "image/gif":
            ext = "gif"
        elif format == "video/mp4":
            ext = "mp4"
        else:
            ext = "webm"

        file = f"{filename}_{counter:05}_.{ext}"
        
        # imageio requires uint8
        video_data = (images.cpu().numpy() * 255).astype(np.uint8)

        if pingpong:
            video_data = np.concatenate((video_data, video_data[-2:0:-1]), axis=0)

        if format == "image/gif":
            imageio.mimsave(os.path.join(full_output_folder, file), video_data, duration=(1000/frame_rate)/1000, loop=loop_count)
        else:
            imageio.mimsave(os.path.join(full_output_folder, file), video_data, fps=frame_rate)

        results.append({
            "filename": file,
            "subfolder": subfolder,
            "type": self.type
        })

        server_instance = server.PromptServer.instance
        if server_instance:
            for result in results:
                video_url = f"/view?filename={result['filename']}&subfolder={result['subfolder']}&type={result['type']}"
                message_data = {
                    "status": "video_generated",
                    "video_url": video_url,
                    "filename": result['filename'],
                    "subfolder": result['subfolder'],
                    "type": result['type']
                }
                server_instance.send_sync("cozygen_video_ready", message_data)
                print(f"CozyGen: Sent custom WebSocket message: {{'type': 'cozygen_video_ready', 'data': {message_data}}}")

        return { "ui": { "videos": results } }

NODE_CLASS_MAPPINGS = {
    "CozyGenOutput": CozyGenOutput,
    "CozyGenVideoOutput": CozyGenVideoOutput,
    "CozyGenDynamicInput": CozyGenDynamicInput,
    "CozyGenImageInput": CozyGenImageInput,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "CozyGenOutput": "CozyGen Output",
    "CozyGenDynamicInput": "CozyGen Dynamic Input",
    "CozyGenImageInput": "CozyGen Image Input",
}