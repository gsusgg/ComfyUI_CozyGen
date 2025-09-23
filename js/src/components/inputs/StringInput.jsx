import React from 'react';

const StringInput = ({ value, onChange, multiline }) => {
  if (multiline) {
    return (
      <textarea
        rows={6}
        className="block w-full p-2.5 border border-base-300 bg-base-100 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all h-40 min-h-24 resize-y"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <input
      type="text"
      className="block w-full p-2.5 border border-base-300 bg-base-100 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
};

export default StringInput;
