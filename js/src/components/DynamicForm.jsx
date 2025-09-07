import React from 'react';
import StringInput from './inputs/StringInput';
import NumberInput from './inputs/NumberInput';
import BooleanInput from './inputs/BooleanInput';
import DropdownInput from './inputs/DropdownInput';

const renderInput = (input, formData, onFormChange, randomizeState, onRandomizeToggle) => {
    console.log("Rendering input:", input); // DEBUGGING
    const { id, inputs } = input;
    const param_name = inputs['param_name'];
    const param_type = inputs['param_type'];
    const defaultValue = inputs['default_value'];
    const value = formData[param_name] !== undefined ? formData[param_name] : defaultValue;

    switch (param_type) {
        case 'STRING':
            return <StringInput 
                        label={param_name} 
                        value={value} 
                        onChange={(val) => onFormChange(param_name, val)} 
                        multiline={inputs['Multiline']}
                    />;
        case 'INT':
        case 'FLOAT':
            return <NumberInput
                        label={param_name}
                        value={value}
                        onChange={(val) => onFormChange(param_name, val)}
                        onRandomizeToggle={inputs['add_randomize_toggle'] ? (isRandom) => onRandomizeToggle(param_name, isRandom) : null}
                        isRandomized={randomizeState[param_name] || false}
                        min={inputs['min_value']}
                        max={inputs['max_value']}
                        step={inputs['step']}
                    />;
        case 'BOOLEAN':
            return <BooleanInput
                        label={param_name}
                        value={value}
                        onChange={(val) => onFormChange(param_name, val)}
                    />;
        case 'DROPDOWN':
            return <DropdownInput
                        label={param_name}
                        value={value}
                        onChange={(val) => onFormChange(param_name, val)}
                        choices={inputs['choices']}
                    />;
        default:
            return <p>Unsupported input type: {param_type}</p>;
    }
}

const DynamicForm = ({ inputs, formData, onFormChange, randomizeState, onRandomizeToggle }) => {
  if (!inputs || inputs.length === 0) {
    return (
        <div className="bg-base-200 shadow-lg rounded-lg p-4 text-center">
            <p className="text-gray-400">Select a workflow to see its controls.</p>
        </div>
    );
  }

  return (
    <div className="bg-base-200 shadow-lg rounded-lg p-4">
      <h2 className="text-lg font-semibold text-white mb-2">Controls</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
        {inputs.map(input => (
            <div key={input.id} className={input.inputs['Multiline'] ? 'sm:col-span-2' : ''}>{renderInput(input, formData, onFormChange, randomizeState, onRandomizeToggle)}</div>
        ))}
      </div>
    </div>
  );
};

export default DynamicForm;
