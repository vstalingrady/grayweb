import React from 'react';
import { SearchIcon } from '../icons/SearchIcon';

const historyData: { title: string; date: string }[] = [];

const HistoryPage: React.FC = () => {
    return (
        <div className="flex flex-col h-full text-zinc-200 p-8 max-w-4xl mx-auto w-full">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-white">History</h1>
            </header>

            <div className="mb-8">
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <SearchIcon className="w-5 h-5 text-zinc-400" />
                    </div>
                    <input
                        type="search"
                        placeholder="Search"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-2.5 pl-11 pr-4 text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-600"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                <ul>
                    {historyData.map((item, index) => (
                        <li key={index} className="flex justify-between items-center py-4 border-b border-zinc-800 hover:bg-zinc-800/50 px-2 rounded-md">
                            <span className="text-base text-zinc-200">{item.title}</span>
                            <span className="text-sm text-zinc-400 whitespace-nowrap">{item.date}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default HistoryPage;
