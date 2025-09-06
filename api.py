from aiohttp import web
import os
import json
import folder_paths
from PIL import Image
import server # Import server for node_info

# Hardcoded lists for schedulers and samplers
SCHEDULERS = ["simple", "sgm_uniform", "karras", "exponential", "ddim_uniform", "beta", "normal", "linear_quadratic", "kl_optimal"]
SAMPLERS = ["euler", "euler_ancestral", "heun", "dpm_2", "dpm_2_ancestral", "lms", "dpmpp_2s_a", "dpmpp_sde", "dpmpp_sde_gpu", "dpmpp_2m", "dpmpp_2m_sde", "dpmpp_2m_sde_gpu", "dpmpp_3m_sde", "dpmpp_3m_sde_gpu", "ddim", "uni_pc", "uni_pc_bh2"]

def extract_png_info(image_path):
    """Extracts prompt and seed from PNG metadata."""
    try:
        with Image.open(image_path) as img:
            if "prompt" in img.info:
                prompt_str = img.info["prompt"]
                prompt_json = json.loads(prompt_str)
                
                # Attempt to find seed and positive prompt
                seed = None
                positive_prompt = ""

                # Iterate through the workflow nodes to find seed and positive prompt
                for node_id, node_data in prompt_json.items():
                    if node_data.get("class_type") == "KSampler" and "seed" in node_data.get("inputs", {}):
                        seed = node_data["inputs"]["seed"]
                    if node_data.get("class_type") == "CLIPTextEncode" and "text" in node_data.get("inputs", {}):
                        positive_prompt = node_data["inputs"]["text"]
                    
                    if seed is not None and positive_prompt != "":
                        break # Found both, can stop early

                return {"prompt": positive_prompt, "seed": seed, "full_workflow": prompt_json}
    except Exception as e:
        print(f"CozyGen: Error extracting PNG info from {image_path}: {e}")
    return None

async def get_hello(request: web.Request) -> web.Response:
    return web.json_response({"status": "success", "message": "Hello from the CozyGen API!"})

async def get_gallery_files(request: web.Request) -> web.Response:
    subfolder = request.rel_url.query.get('subfolder', '')
    output_directory = folder_paths.get_output_directory()

    # Security: Prevent directory traversal
    # Normalize the path and ensure it's within the output directory
    gallery_path = os.path.normpath(os.path.join(output_directory, subfolder))
    if not gallery_path.startswith(output_directory):
        return web.json_response({"error": "Unauthorized path"}, status=403)

    if not os.path.exists(gallery_path) or not os.path.isdir(gallery_path):
        return web.json_response({"error": "Gallery directory not found"}, status=404)

    items = os.listdir(gallery_path)
    gallery_items = []

    for item_name in items:
        item_path = os.path.join(gallery_path, item_name)
        
        if os.path.isdir(item_path):
            gallery_items.append({
                "filename": item_name,
                "type": "directory",
                "subfolder": os.path.join(subfolder, item_name)
            })
        elif item_name.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp')):
            metadata = None
            if item_name.lower().endswith('.png'):
                metadata = extract_png_info(item_path)

            mod_time = os.path.getmtime(item_path)

            gallery_items.append({
                "filename": item_name,
                "type": "output",
                "subfolder": subfolder,
                "metadata": metadata,
                "mod_time": mod_time
            })

    # Sort items: directories first, then by modification time
    gallery_items.sort(key=lambda x: (x['type'] != 'directory', x.get('mod_time', 0)), reverse=True)

    # Remove mod_time before sending
    for item in gallery_items:
        if 'mod_time' in item:
            del item['mod_time']

    return web.json_response(gallery_items)

async def get_workflow_list(request: web.Request) -> web.Response:
    workflows_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "workflows")
    if not os.path.exists(workflows_dir):
        return web.json_response({"error": "Workflows directory not found"}, status=404)
    
    workflow_files = [f for f in os.listdir(workflows_dir) if f.endswith('.json')]
    return web.json_response({"workflows": workflow_files})

async def get_workflow_file(request: web.Request) -> web.Response:
    filename = request.match_info.get('filename', '')
    workflows_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "workflows")
    workflow_path = os.path.join(workflows_dir, filename)

    if not os.path.exists(workflow_path):
        return web.json_response({"error": f"Workflow file '{filename}' not found"}, status=404)
    
    try:
        with open(workflow_path, 'r', encoding='utf-8') as f:
            workflow_content = json.load(f)
        return web.json_response(workflow_content)
    except json.JSONDecodeError:
        return web.json_response({"error": f"Invalid JSON in workflow file '{filename}'"}, status=400)
    except Exception as e:
        return web.json_response({"error": f"Error reading workflow file: {e}"}, status=500)

async def get_choices(request: web.Request) -> web.Response:
    choice_type = request.rel_url.query.get('type', '')
    if not choice_type:
        return web.json_response({"error": "Missing 'type' query parameter"}, status=400)

    choices = []
    if choice_type == "schedulers_list":
        choices = SCHEDULERS
    elif choice_type == "samplers_list":
        choices = SAMPLERS
    else:
        try:
            choices = folder_paths.get_filename_list(choice_type)
        except Exception as e:
            print(f"CozyGen: Error getting choices for type '{choice_type}': {e}")
            return web.json_response({"error": f"Error getting choices for type '{choice_type}': {e}"}, status=500)
    
    return web.json_response({"choices": choices})

routes = [
    web.get('/cozygen/hello', get_hello),
    web.get('/cozygen/gallery', get_gallery_files),
    web.get('/cozygen/workflows', get_workflow_list),
    web.get('/cozygen/workflows/{filename}', get_workflow_file),
    web.get('/cozygen/get_choices', get_choices),
]