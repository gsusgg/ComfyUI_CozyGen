import React from 'react';

const NumberInput = ({ inputName, value, onChange, min, max, step, paramType }) => {

  const handleValueChange = (e) => {
    const val = e.target.value;
    onChange(val);
  };

  // Determine the effective step value
  let effectiveStep = step;
  if (effectiveStep === 0 || effectiveStep === undefined || effectiveStep === null) {
    if (paramType === 'INT') {
      effectiveStep = 1;
    } else if (paramType === 'FLOAT') {
      effectiveStep = 0.1; // Default step for floats if not specified
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-center space-x-2">
        <input
          type="number"
          className="block w-full p-2.5 border border-base-300 bg-base-100 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all disabled:bg-base-300/50"
          value={value || ''}
          onChange={handleValueChange}
          min={min}
          max={max}
          step={effectiveStep}
        />
      </div>
    </div>
  );
};

export default NumberInput;
