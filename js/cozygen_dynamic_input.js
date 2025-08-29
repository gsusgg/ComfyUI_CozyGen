import { app } from "/scripts/app.js";

(function () {
    // Helper function to determine if a value matches a given type
    function valueMatchesType(value, type, options) {
        if (type === "number" || type === "number (integer)") {
            return typeof value === "number";
        } else if (type === "combo") {
            return options?.values?.includes(value);
        } else if (type === "toggle") {
            return typeof value === "boolean";
        }
        return typeof value === "string";
    }

    // Function to change the widgets on the CozyGenDynamicInput node
    function changeCozyGenWidgets(node, connectedInputType, connectedInputProps, connectedWidget) {
        let paramType = "STRING";
        let defaultValue = "";
        let min = 0.0;
        let max = 1.0;
        let increment = null;
        let multiline = false;
        let choices = [];

        let detectedWidgetType = connectedWidget?.type; // Use optional chaining

        // Determine the type and properties based on the connected input
        if (connectedInputType === "COMBO") { // Explicitly check for "COMBO" string type
            paramType = "DROPDOWN";
            // For COMBO types, choices are often in inputWidget.options.values
            // or sometimes directly in input.options.values (which is connectedInputProps)
            if (connectedWidget?.options?.values) {
                choices = connectedWidget.options.values;
            } else if (connectedInputProps.values) { // Fallback to connectedInputProps.values
                choices = connectedInputProps.values;
            } else if (Array.isArray(connectedWidget?.options?.default_value)) { // Sometimes default_value is the list
                choices = connectedWidget.options.default_value;
            } else if (Array.isArray(connectedWidget?.options?.input_type)) { // Another possible location for choices
                choices = connectedWidget.options.input_type;
            }
            
            defaultValue = connectedInputProps.default;
            if (!choices.includes(defaultValue) && choices.length > 0) {
                defaultValue = choices[0];
            } else if (choices.length === 0) {
                defaultValue = "";
            }
        } else if (connectedInputType === "INT" || (detectedWidgetType === "number" && connectedInputProps.precision === 0)) {
            paramType = "INT";
            defaultValue = connectedInputProps.default || 0;
            min = connectedInputProps.min || 0;
            max = connectedInputProps.max || 0;
            increment = connectedInputProps.step || 1;
        } else if (connectedInputType === "FLOAT" || detectedWidgetType === "number") {
            paramType = "FLOAT";
            defaultValue = connectedInputProps.default || 0.0;
            min = connectedInputProps.min || 0.0;
            max = connectedInputProps.max || 0.0;
            increment = connectedInputProps.step || 0.01;
        } else if (connectedInputType === "STRING" || detectedWidgetType === "text") {
            paramType = "STRING";
            defaultValue = connectedInputProps.default || "";
            multiline = connectedInputProps.multiline || false;
        } else if (connectedInputType === "BOOLEAN" || detectedWidgetType === "toggle") {
            paramType = "BOOLEAN";
            defaultValue = connectedInputProps.default || false;
        }

        // Update the selected value of the param_type dropdown (widget at index 2)
        node.widgets[2].value = paramType;

        // Remove all widgets after param_type (index 2)
        while (node.widgets.length > 3) { // Keep param_name, priority, param_type
            node.widgets.pop();
        }

        // Add the default_value widget with the correct type
        let defaultWidget;
        if (paramType === "DROPDOWN") {
            defaultWidget = node.addWidget("combo", "default_value", defaultValue, function(v) { node.properties["default_value"] = v; }, { values: choices });
        } else if (paramType === "INT") {
            defaultWidget = node.addWidget("number", "default_value", defaultValue, function(v) { node.properties["default_value"] = v; }, { precision: 0, min: min, max: max, step: increment });
        } else if (paramType === "FLOAT") {
            defaultWidget = node.addWidget("number", "default_value", defaultValue, function(v) { node.properties["default_value"] = v; }, { min: min, max: max, step: increment });
        } else if (paramType === "BOOLEAN") {
            defaultWidget = node.addWidget("toggle", "default_value", defaultValue, function(v) { node.properties["default_value"] = v; });
        } else { // STRING
            // For STRING, create the text widget first.
            defaultWidget = node.addWidget("text", "default_value", defaultValue, function(v) { node.properties["default_value"] = v; }, { multiline: multiline });

            // Then add the multiline toggle that controls it.
            let multilineToggle = node.addWidget("toggle", "Multiline", multiline, function(v) {
                // Update the multiline property of the default_value widget
                defaultWidget.options.multiline = v;
                node.properties["multiline"] = v; // Also update the property
                // We need to tell the node to redraw to see the change from single to multi-line
                node.setDirtyCanvas(true, true);
            });
            node.properties["multiline"] = multilineToggle.value; // Link to node.properties
        }
        // Link the widget value to node.properties
        node.properties["default_value"] = defaultWidget.value;


        // Add min/max/step for number types if applicable
        if (paramType === "INT" || paramType === "FLOAT") {
            let minWidget = node.addWidget("number", "min_value", min, function(v) { node.properties["min_value"] = v; }, { precision: (paramType === "INT" ? 0 : undefined) });
            let maxWidget = node.addWidget("number", "max_value", max, function(v) { node.properties["max_value"] = v; }, { precision: (paramType === "INT" ? 0 : undefined) });
            let incrementWidget = node.addWidget("number", "increment", increment, function(v) { node.properties["increment"] = v; }, { precision: (paramType === "INT" ? 0 : undefined) });
            
            node.properties["min_value"] = minWidget.value;
            node.properties["max_value"] = maxWidget.value;
            node.properties["increment"] = incrementWidget.value;

            // Add the randomize toggle
            let randomizeToggle = node.addWidget("toggle", "add_randomize_toggle", node.properties["add_randomize_toggle"], function(v) { node.properties["add_randomize_toggle"] = v; });

        } else {
            // Ensure these properties are reset or not present if not a number type
            node.properties["min_value"] = 0.0;
            node.properties["max_value"] = 1.0;
            node.properties["increment"] = 0.0;
        }

        // Ensure multiline and choices properties are correctly set/reset
        node.properties["multiline"] = multiline;
        const choicesInput = node.inputs.find(input => input.name === 'choices');
        if (choicesInput) {
            choicesInput.value = choices.join(",");
        } else {
            console.warn("CozyGen: 'choices' input object not found. This is unexpected.");
            node.properties["choices"] = choices.join(","); // Fallback, though this is not persisting
        }

        // Update node size to fit new widgets
        node.setDirtyCanvas(true);
    }

    // Function to adapt widgets based on connection
    function adaptCozyGenWidgetsToConnection(node) {
        if (!node.outputs || node.outputs.length === 0) {
            return;
        }

        const links = node.outputs[0].links; // Assuming the first output is the dynamic one

        if (links && links.length === 1) {
            const link = node.graph.links[links[0]];
            if (!link) return;

            const theirNode = node.graph.getNodeById(link.target_id);
            if (!theirNode || !theirNode.inputs) return;

            const input = theirNode.inputs[link.target_slot];
            if (!input) return;

            // Get the actual widget object from the connected node's widgets array
            const connectedWidget = theirNode.widgets.find(w => w.name === input.name);
            if (!connectedWidget) return; // Should not happen for standard inputs

            // Get the actual type and properties of the connected input
            const connectedInputType = input.type; // This is still correct
            const connectedInputProps = connectedWidget.options || {}; // Use the full widget's options

            // Update param_name if it's still default
            if (node.widgets[0].value === "Dynamic Parameter") {
                node.widgets[0].value = input.name || "Dynamic Parameter";
            }

            changeCozyGenWidgets(node, connectedInputType, connectedInputProps, connectedWidget);

        } else {
            // No connection or multiple connections, revert to default state
            // Reset param_name to default
            node.widgets[0].value = "Dynamic Parameter";

            // Update param_type to STRING
            node.widgets[2].value = "STRING";

            // Remove all widgets after param_type (index 2)
            while (node.widgets.length > 3) { // Keep param_name, priority, param_type
                node.widgets.pop();
            }
            
            // Add default_value as STRING
            let defaultWidget = node.addWidget("text", "default_value", "", function(v) { node.properties["default_value"] = v; }, { multiline: false });
            node.properties["default_value"] = defaultWidget.value;

            // Reset other properties
            node.properties["min_value"] = 0.0;
            node.properties["max_value"] = 1.0;
            node.properties["increment"] = 0.0;
            node.properties["multiline"] = false;
            node.properties["choices"] = "";
            
            node.setDirtyCanvas(true);
        }
    }

    // Setup function for CozyGenDynamicInput node
    function setupCozyGenDynamicInputNode(nodeType) {
        const onAdded = nodeType.prototype.onAdded;
        nodeType.prototype.onAdded = function () {
            onAdded?.apply(this, arguments);
            // Initial adaptation when node is added
            adaptCozyGenWidgetsToConnection(this);
        };

        const onAfterGraphConfigured = nodeType.prototype.onAfterGraphConfigured;
        nodeType.prototype.onAfterGraphConfigured = function () {
            onAfterGraphConfigured?.apply(this, arguments);
            // Adaptation after graph is loaded/configured
            adaptCozyGenWidgetsToConnection(this);
        };

        const onConnectionsChange = nodeType.prototype.onConnectionsChange;
        nodeType.prototype.onConnectionsChange = function (_, index, connected) {
            // Only adapt if the change is on the output and not during graph configuration
            if (index === 0 && !app.configuringGraph) { // Assuming output is at index 0
                adaptCozyGenWidgetsToConnection(this);
            }
            onConnectionsChange?.apply(this, arguments);
        };
    }

    // Register the extension
    app.registerExtension({
        name: "cozygen.dynamic_input",
        beforeRegisterNodeDef(nodeType, nodeData, app) {
            if (nodeData.name === "CozyGenDynamicInput") {
                setupCozyGenDynamicInputNode(nodeType);
            }
        },
    });
})();