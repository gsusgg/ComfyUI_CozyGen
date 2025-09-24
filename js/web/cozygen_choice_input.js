import { app } from "../../scripts/app.js";

// Helper function to get choices from the backend API
async function getChoices(choiceType) {
    try {
        const response = await fetch(`/cozygen/get_choices?type=${choiceType}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch choices: ${response.statusText}`);
        }
        const data = await response.json();
        return data.choices || [];
    } catch (error) {
        console.error(`CozyGenChoiceInput: Error fetching choices for type '${choiceType}':`, error);
        return [];
    }
}

app.registerExtension({
	name: "CozyGen.ChoiceInput",
	async beforeRegisterNodeDef(nodeType, nodeData, app) {
		if (nodeData.name === "CozyGenChoiceInput") {
			// This function is called when the node is created in the graph
			const onNodeCreated = nodeType.prototype.onNodeCreated;
			nodeType.prototype.onNodeCreated = async function () {
				onNodeCreated?.apply(this, arguments);

                const choiceTypeWidget = this.widgets.find((w) => w.name === "choice_type");
                const valueWidget = this.widgets.find((w) => w.name === "value"); // The hidden value widget
                const bypassWidget = this.widgets.find((w) => w.name === "display_bypass");

                if (!choiceTypeWidget || !valueWidget) {
                    console.error("CozyGenChoiceInput: Required widgets not found!");
                    return;
                }

                const choices = await getChoices(choiceTypeWidget.value);

                const comboWidget = {
                    type: "combo",
                    name: "value", // This must match the hidden input name
                    value: choices.includes(valueWidget.value) ? valueWidget.value : choices[0],
                    callback: (v) => { valueWidget.value = v; },
                    options: { values: choices }
                };
                this.widgets.splice(this.widgets.indexOf(valueWidget), 1, comboWidget);

                if (bypassWidget && bypassWidget.value) {
                    this.addWidget("toggle", "Bypass", false, (v) => {
                        console.log(`Bypass toggled to: ${v}`);
                    });
                }
			};
		}
	},
});
