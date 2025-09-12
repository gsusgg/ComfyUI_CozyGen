import React from 'react';

const BooleanInput = ({ value, onChange }) => {
  return (
    <div className="w-full">
        <div 
            onClick={() => onChange(!value)}
            className={`w-14 h-8 flex items-center rounded-full p-1 cursor-pointer transition-colors ${value ? 'bg-accent' : 'bg-base-100'}`}>
            <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform ${value ? 'translate-x-6' : ''}`} />
        </div>
    </div>
  );
};

export default BooleanInput;
