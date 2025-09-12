import os
import sys
import server
from aiohttp import web # Import web for static files
from .api import routes as api_routes
from .nodes import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

# Mount API routes
for route in api_routes:
    server.PromptServer.instance.app.router.add_route(
        route.method,
        route.path,
        route.handler,
        name=f"cozygen_{route.handler.__name__}"
    )

# Handler to serve the React app's index.html
async def serve_cozygen_app(request: web.Request) -> web.Response:
    index_path = os.path.join(os.path.dirname(__file__), "js", "dist", "index.html")
    if not os.path.exists(index_path):
        return web.Response(text="CozyGen: Build not found. Please run `npm run build` in the `js` directory.", status=500)
    return web.FileResponse(index_path)

# Route to serve the main application
server.PromptServer.instance.app.router.add_get('/cozygen', serve_cozygen_app)
server.PromptServer.instance.app.router.add_get('/cozygen/', serve_cozygen_app)


# Serve the new 'dist' directory which contains the built React app
static_dist_path = os.path.join(os.path.dirname(__file__), "js", "dist")
server.PromptServer.instance.app.router.add_static(
    "/cozygen/assets", path=os.path.join(static_dist_path, "assets"), name="cozygen_assets"
)


__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS']

print("✅ CozyGen API routes mounted.")
print("✅ CozyGen web UI served at /cozygen/")

WEB_DIRECTORY = "./js/web"
