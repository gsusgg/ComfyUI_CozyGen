import React from 'react';

const StringInput = ({ label, value, onChange, multiline }) => {
  const InputComponent = multiline ? 'textarea' : 'input';

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      <InputComponent
        type="text"
        rows={multiline ? 6 : undefined}
        className="block w-full p-2.5 border border-base-300 bg-base-100 text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};

export default StringInput;
