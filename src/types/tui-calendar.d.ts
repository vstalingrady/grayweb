declare module '@toast-ui/react-calendar' {
    import { Component } from 'react';
    import type { Options, EventObject } from '@toast-ui/calendar';

    export interface CalendarProps extends Options {
        ref?: any;
        view?: string;
        events?: Partial<EventObject>[];
        onBeforeCreateEvent?: (event: any) => void;
        onBeforeUpdateEvent?: (event: any) => void;
        onBeforeDeleteEvent?: (event: any) => void;
        [key: string]: any;
    }

    export default class Calendar extends Component<CalendarProps> { }
}

declare module '@toast-ui/calendar' {
    export interface Options {
        defaultView?: string;
        theme?: any;
        template?: any;
        week?: any;
        month?: any;
        useCreationPopup?: boolean;
        useDetailPopup?: boolean;
        [key: string]: any;
    }
    export interface EventObject {
        id?: string;
        calendarId?: string;
        title?: string;
        body?: string;
        start?: any;
        end?: any;
        category?: string;
        dueDateClass?: string;
        color?: string;
        backgroundColor?: string;
        dragBackgroundColor?: string;
        borderColor?: string;
        customStyle?: any;
        isReadOnly?: boolean;
        [key: string]: any;
    }
}
