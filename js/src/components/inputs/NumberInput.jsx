import React from 'react';

const NumberInput = ({ inputName, value, onChange, min, max, step }) => {

  const handleValueChange = (e) => {
    const val = e.target.value;
    onChange(val);
  };

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
          step={step}
        />
      </div>
    </div>
  );
};

export default NumberInput;
