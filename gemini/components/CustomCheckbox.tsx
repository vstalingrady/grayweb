
import React from 'react';

interface CustomCheckboxProps {
  checked: boolean;
  onChange: () => void;
}

const CustomCheckbox: React.FC<CustomCheckboxProps> = ({ checked, onChange }) => {
  return (
    <div
      className={`w-5 h-5 flex-shrink-0 border-2 rounded-sm cursor-pointer flex items-center justify-center transition-all duration-200 
        ${checked ? 'bg-blue-600 border-blue-600' : 'border-gray-600 hover:border-gray-400'}`}
      onClick={onChange}
    >
      {checked && (
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
  );
};

export default CustomCheckbox;
