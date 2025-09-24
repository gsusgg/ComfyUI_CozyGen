import React from 'react';

const BooleanInput = ({ value, onChange, disabled }) => {
  return (
    <div className="w-full">
        <div 
            onClick={() => !disabled && onChange(!value)}
            className={`w-14 h-8 flex items-center rounded-full p-1 cursor-pointer transition-colors ${value ? 'bg-accent' : 'bg-base-100'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform ${value ? 'translate-x-6' : ''}`} />
        </div>
    </div>
  );
};

export default BooleanInput;
