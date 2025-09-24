import React from 'react';

const StringInput = ({ value, onChange, multiline, disabled }) => {
  const disabledClasses = "disabled:bg-base-300/50 disabled:cursor-not-allowed disabled:text-gray-400";

  if (multiline) {
    return (
      <textarea
        rows={6}
        className={`block w-full p-2.5 border border-base-300 bg-base-100 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all h-40 min-h-24 resize-y ${disabledClasses}`}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    );
  }

  return (
    <input
      type="text"
      className={`block w-full p-2.5 border border-base-300 bg-base-100 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all ${disabledClasses}`}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
  );
};

export default StringInput;
