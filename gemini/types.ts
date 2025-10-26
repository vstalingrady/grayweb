
export interface Plan {
  id: number;
  text: string;
  completed: boolean;
}

export interface Habit {
  id: number;
  text: string;
  streak: number;
  prev: string;
}

export interface Proactivity {
  id: number;
  title: string;
  description: string;
  cadence: 'Daily' | 'Weekly' | 'Monthly';
  time: string;
  completed: boolean;
}

export interface HistoryGroup {
  period: string;
  items: string[];
}
