from aiohttp import web
import os
import json
import folder_paths
from PIL import Image
import server # Import server for node_info
import uuid # For generating unique filenames

# Hardcoded lists for schedulers and samplers
SCHEDULERS = ["simple", "sgm_uniform", "karras", "exponential", "ddim_uniform", "beta", "normal", "linear_quadratic", "kl_optimal"]
SAMPLERS = ["euler", "euler_ancestral", "heun", "dpm_2", "dpm_2_ancestral", "lms", "dpmpp_2s_a", "dpmpp_sde", "dpmpp_sde_gpu", "dpmpp_2m", "dpmpp_2m_sde", "dpmpp_2m_sde_gpu", "dpmpp_3m_sde", "dpmpp_3m_sde_gpu", "ddim", "uni_pc", "uni_pc_bh2"]


async def get_hello(request: web.Request) -> web.Response:
    return web.json_response({"status": "success", "message": "Hello from the CozyGen API!"})

async def get_gallery_files(request: web.Request) -> web.Response:
    subfolder = request.rel_url.query.get('subfolder', '')
    try:
        page = int(request.rel_url.query.get('page', '1'))
        per_page = int(request.rel_url.query.get('per_page', '20'))
    except ValueError:
        return web.json_response({"error": "Invalid page or per_page parameter"}, status=400)

    output_directory = folder_paths.get_output_directory()

    # Security: Prevent directory traversal
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
            mod_time = os.path.getmtime(item_path)

            gallery_items.append({
                "filename": item_name,
                "type": "output",
                "subfolder": subfolder,
                "mod_time": mod_time
            })

    # Sort items: directories first, then by modification time
    gallery_items.sort(key=lambda x: (x['type'] != 'directory', x.get('mod_time', 0)), reverse=True)

    # Pagination
    total_items = len(gallery_items)
    total_pages = (total_items + per_page - 1) // per_page
    start_index = (page - 1) * per_page
    end_index = start_index + per_page
    paginated_items = gallery_items[start_index:end_index]

    # Remove mod_time before sending
    for item in paginated_items:
        if 'mod_time' in item:
            del item['mod_time']

    return web.json_response({
        "items": paginated_items,
        "page": page,
        "per_page": per_page,
        "total_pages": total_pages,
        "total_items": total_items
    })

async def upload_image(request: web.Request) -> web.Response:
    reader = await request.multipart()
    field = await reader.next()

    if field.name != 'image':
        return web.json_response({"error": "Expected field 'image'"}, status=400)

    filename = field.filename
    if not filename:
        return web.json_response({"error": "No filename provided"}, status=400)

    # Generate a unique filename to prevent collisions
    unique_filename = f"{uuid.uuid4()}_{filename}"
    
    # Save to the input directory of ComfyUI
    input_dir = folder_paths.get_input_directory()
    save_path = os.path.join(input_dir, unique_filename)

    size = 0
    with open(save_path, 'wb') as f:
        while True:
            chunk = await field.read_chunk()
            if not chunk:
                break
            f.write(chunk)
            size += len(chunk)

    return web.json_response({"filename": unique_filename, "size": size})

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
    web.post('/cozygen/upload_image', upload_image),
    web.get('/cozygen/workflows', get_workflow_list),
    web.get('/cozygen/workflows/{filename}', get_workflow_file),
    web.get('/cozygen/get_choices', get_choices),
]