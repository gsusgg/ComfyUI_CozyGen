import React from 'react';

const NumberInput = ({ label, value, onChange, onRandomizeToggle, isRandomized, min, max, step }) => {

  const handleValueChange = (e) => {
    const val = e.target.value;
    onChange(val);
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      <div className="flex items-center space-x-2">
        <input
          type="number"
          className="block w-full p-2.5 border border-base-300 bg-base-100 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all disabled:bg-base-300/50"
          value={isRandomized ? '' : (value || '')}
          onChange={handleValueChange}
          disabled={isRandomized}
          min={min}
          max={max}
          step={step}
        />
        {onRandomizeToggle && (
          <div className="flex items-center h-full">
            <input
              type="checkbox"
              id={`${label}-randomize`}
              className="h-5 w-5 rounded border-base-300 bg-base-100 text-accent focus:ring-accent-focus"
              checked={isRandomized}
              onChange={(e) => onRandomizeToggle(e.target.checked)}
            />
            <label htmlFor={`${label}-randomize`} className="ml-2 text-sm text-gray-400">Rand</label>
          </div>
        )}
      </div>
    </div>
  );
};

export default NumberInput;
