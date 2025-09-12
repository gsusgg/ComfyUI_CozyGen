import React from 'react';

const DropdownInput = ({ value, onChange, choices }) => {
  return (
    <div className="w-full">
      <select
        className="block w-full p-2.5 border border-base-300 bg-base-100 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      >
        {Array.isArray(choices) && choices.map((choice) => (
          <option key={choice} value={choice}>
            {choice}
          </option>
        ))}
      </select>
    </div>
  );
};

export default DropdownInput;
