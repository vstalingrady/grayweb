
import React, { useState } from 'react';
import type { Plan, Habit, Proactivity } from '../types';
import Card from './Card';
import CustomCheckbox from './CustomCheckbox';

const initialPlans: Plan[] = [
  { id: 1, text: 'Restore proactive cadence for the builder cohort.', completed: false },
  { id: 2, text: 'Draft mitigation follow-up checklist.', completed: false },
  { id: 3, text: 'Lock launch checklist scope for the revamp.', completed: true },
  { id: 4, text: 'Draft async sync for builder cohort.', completed: false },
];

const initialHabits: Habit[] = [
  { id: 1, text: 'Coaching loop deferred until services stabilize.', streak: 4, prev: 'YESTERDAY — 3 DAYS' },
  { id: 2, text: 'No YouTube', streak: 6, prev: 'YESTERDAY — 5 DAYS' },
  { id: 3, text: 'Movement break', streak: 2, prev: 'YESTERDAY — 5 DAYS' },
];

const initialProactivity: Proactivity[] = [
    { id: 1, title: 'Check-ins', description: 'Daily sync nudges for squad channels.', cadence: 'Daily', time: '09:00 AM', completed: true }
]


const Dashboard: React.FC = () => {
    const [plans, setPlans] = useState<Plan[]>(initialPlans);
    
    const togglePlan = (id: number) => {
        setPlans(plans.map(plan => plan.id === id ? { ...plan, completed: !plan.completed } : plan));
    };

  return (
    <div className="w-full">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold text-gray-200 tracking-wider">DASHBOARD</h1>
        <div className="flex items-center gap-2">
            <button className="bg-[#2a2b31] border border-gray-700/50 text-white text-sm font-semibold px-4 py-2 rounded-full hover:bg-gray-700 transition-colors">PULSE</button>
            <button className="bg-[#2a2b31] border border-gray-700/50 text-white text-sm font-semibold px-4 py-2 rounded-full hover:bg-gray-700 transition-colors">CALENDAR</button>
        </div>
      </header>
      
      <div className="text-right text-gray-500 text-xs font-medium mb-4 tracking-widest">
        17 OCTOBER
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="PLANS">
            <div className="space-y-3">
                {plans.map(plan => (
                     <div key={plan.id} className="flex items-center gap-3 bg-[#1C1D22]/80 p-3 rounded-lg border border-gray-700/50">
                        <CustomCheckbox checked={plan.completed} onChange={() => togglePlan(plan.id)} />
                        <span className={`text-sm ${plan.completed ? 'line-through text-gray-500' : 'text-gray-300'}`}>{plan.text}</span>
                    </div>
                ))}
            </div>
            <button className="w-full mt-4 bg-transparent border border-gray-700/50 text-gray-400 text-sm py-2 rounded-md hover:bg-[#2a2b31] transition-colors">ADD PLANS</button>
        </Card>
        
        <Card title="HABITS">
             <div className="space-y-3">
                {initialHabits.map(habit => (
                     <div key={habit.id} className="flex items-start gap-3 bg-[#1C1D22]/80 p-3 rounded-lg border border-gray-700/50">
                        <CustomCheckbox checked={false} onChange={() => {}} />
                        <div className="flex-1">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-300">{habit.text}</span>
                                <span className="text-sm text-yellow-400/80 flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    {habit.streak} days
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">PREV: {habit.prev}</p>
                        </div>
                    </div>
                ))}
            </div>
            <button className="w-full mt-4 bg-transparent border border-gray-700/50 text-gray-400 text-sm py-2 rounded-md hover:bg-[#2a2b31] transition-colors">ADD HABITS</button>
        </Card>

        <Card title="PROACTIVITY">
            <div className="space-y-3">
                 {initialProactivity.map(item => (
                     <div key={item.id} className="bg-[#1C1D22]/80 p-3 rounded-lg border border-gray-700/50">
                        <div className="flex items-start gap-3">
                           <CustomCheckbox checked={item.completed} onChange={() => {}} />
                            <div className="flex-1">
                               <div className="flex justify-between items-center">
                                  <span className="text-sm font-semibold text-gray-200">{item.title}</span>
                                   <div className="flex items-center gap-2">
                                    <span className="text-green-500 text-xs font-bold bg-green-500/20 px-1.5 py-0.5 rounded">GO</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500 hover:text-red-500 cursor-pointer" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                                    </svg>
                                   </div>
                               </div>
                               <p className="text-sm text-gray-400 mt-1">{item.description}</p>
                            </div>
                        </div>
                        <div className="mt-3 flex items-center gap-2 pl-8">
                            <div className="flex-1">
                                <label className="text-xs text-gray-500">CADENCE</label>
                                <select className="w-full bg-transparent text-sm text-gray-300 focus:outline-none">
                                    <option>{item.cadence}</option>
                                </select>
                            </div>
                            <div className="flex-1">
                                 <label className="text-xs text-gray-500">TIME</label>
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-gray-300">{item.time}</span>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.414L11 10.586V6z" clipRule="evenodd" />
                                  </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
             <button className="w-full mt-4 bg-transparent border border-gray-700/50 text-gray-400 text-sm py-2 rounded-md hover:bg-[#2a2b31] transition-colors">ADD PROACTIVITY</button>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
