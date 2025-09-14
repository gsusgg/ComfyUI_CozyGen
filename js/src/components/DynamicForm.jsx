import React from 'react';
import StringInput from './inputs/StringInput';
import NumberInput from './inputs/NumberInput';
import BooleanInput from './inputs/BooleanInput';
import DropdownInput from './inputs/DropdownInput';

const renderInput = (input, formData, onFormChange, randomizeState, onRandomizeToggle, bypassedState, onBypassToggle) => {
    
    const { id, inputs } = input;
    const param_name = inputs['param_name'];
    const param_type = inputs['param_type'];
    const defaultValue = inputs['default_value'];
    const value = formData[param_name] !== undefined ? formData[param_name] : defaultValue;
    const displayBypass = inputs['display_bypass']; // Get the display_bypass property
    const isBypassed = bypassedState[param_name] || false; // Get current bypass state

    let inputComponent;

    switch (param_type) {
        case 'STRING':
            inputComponent = <StringInput 
                        value={value} 
                        onChange={(val) => onFormChange(param_name, val)} 
                        multiline={inputs['Multiline']}
                    />;
            break;
        case 'INT':
        case 'FLOAT':
            inputComponent = <NumberInput
                        inputName={param_name}
                        value={value}
                        onChange={(val) => onFormChange(param_name, val)}
                        onRandomizeToggle={inputs['add_randomize_toggle'] ? (isRandom) => onRandomizeToggle(param_name, isRandom) : null}
                        isRandomized={randomizeState[param_name] || false}
                        min={inputs['min_value']}
                        max={inputs['max_value']}
                        step={inputs['step']}
                        paramType={param_type}
                    />;
            break;
        case 'BOOLEAN':
            inputComponent = <BooleanInput
                        value={value}
                        onChange={(val) => onFormChange(param_name, val)}
                    />;
            break;
        case 'DROPDOWN':
            inputComponent = <DropdownInput
                        value={value}
                        onChange={(val) => onFormChange(param_name, val)}
                        choices={inputs['choices']}
                    />;
            break;
        default:
            inputComponent = <p>Unsupported input type: {param_type}</p>;
    }

    return (
        <div className="flex flex-col"> {/* Use flex-col to stack label/bypass and input */}
            <div className="flex justify-between items-center mb-1"> {/* Flex for label and bypass toggle */}
                <label className="block text-sm font-medium text-gray-300">
                    {param_name}
                    {inputs['add_randomize_toggle'] && (
                        <span className="ml-2 text-xs text-gray-400">
                            (Randomize
                            <input
                                type="checkbox"
                                className="toggle toggle-sm toggle-accent ml-1"
                                checked={randomizeState[param_name] || false}
                                onChange={(e) => onRandomizeToggle(param_name, e.target.checked)}
                            />)
                        </span>
                    )}
                    {displayBypass && (
                        <span className="ml-2 text-xs text-gray-400">
                            (Bypass
                            <input
                                type="checkbox"
                                className="toggle toggle-sm toggle-accent ml-1"
                                checked={isBypassed}
                                onChange={(e) => onBypassToggle(param_name, e.target.checked)}
                            />)
                        </span>
                    )}
                </label>
            </div>
            {inputComponent}
        </div>
    );
};

const DynamicForm = ({ inputs, formData, onFormChange, randomizeState, onRandomizeToggle, bypassedState, onBypassToggle }) => {
  if (!inputs || inputs.length === 0) {
    return (
        <div className="bg-base-200 shadow-lg rounded-lg p-3 text-center">
            <p className="text-gray-400">Select a workflow to see its controls.</p>
        </div>
    );
  }

  return (
    <div className="bg-base-200 shadow-lg rounded-lg p-3">
      <h2 className="text-lg font-semibold text-white mb-2">Controls</h2>
      <div className="grid grid-cols-1 xs:grid-cols-2 gap-x-4 gap-y-4">
        {inputs.map(input => (
            <div key={input.id} className={input.inputs['Multiline'] ? 'xs:col-span-2' : ''}>{renderInput(input, formData, onFormChange, randomizeState, onRandomizeToggle, bypassedState, onBypassToggle)}</div>
        ))}
      </div>
    </div>
  );
};

export default DynamicForm;
