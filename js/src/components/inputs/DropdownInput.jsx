import React from 'react';

const DropdownInput = ({ label, value, onChange, choices }) => {
  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      <select
        className="block w-full p-2.5 border border-base-300 bg-base-100 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      >
        {choices.map((choice) => (
          <option key={choice} value={choice}>
            {choice}
          </option>
        ))}
      </select>
    </div>
  );
};

export default DropdownInput;
