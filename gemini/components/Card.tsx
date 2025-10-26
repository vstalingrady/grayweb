
import React from 'react';

interface CardProps {
  title: string;
  children: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ title, children }) => {
  return (
    <div className="bg-[#1C1D22]/80 border border-gray-700/50 rounded-2xl p-4 h-full flex flex-col">
      <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">{title}</h2>
      <div className="flex-grow">
        {children}
      </div>
    </div>
  );
};

export default Card;
