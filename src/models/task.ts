import parseISO from "date-fns/parseISO";
import * as utils from "../lib/utils";

export default class Task {
    id: string = utils.randomId();
    title: string = "";
    duration?: number;
    number?: number;
    startTime?: string;
    finishTime?: string;
    done: boolean = false;
    postponed: string | null = null;
    recentlyChanged: boolean = false;

    // Todoist's Task
    todoistTaskId?: string;
    todoistPriority?: number;

    // Google Calendar's Event
    eventId?: string;
    eventLink?: string;
    eventStartTime?: string;

    constructor(params?: Partial<Task>) {
        Object.assign(this, params);
    }

    get eventStartTimePassed() {
        return !this.done && this.startTime && this.eventStartTime && this.startTime > this.eventStartTime;
    }

    resetTodoist() {
        this.postponed = null;
        this.todoistTaskId = "";
        this.todoistPriority = 0;
    }

    getUrl() {
        if (this.todoistTaskId) {
            return `https://todoist.com/showTask?id=${this.todoistTaskId}`;
        } else if (this.eventLink) {
            return this.eventLink;
        }
    }

    setGoogleEvent(event: gapi.client.calendar.Event) {
        this.eventId = event.id;
        this.title = event.summary!;
        const start = parseISO(event.start!.dateTime!);
        const end = parseISO(event.end!.dateTime!);
        this.duration = (end.getTime() - start.getTime()) / 1000 / 60;
        this.eventStartTime = utils.timeFormat(start);
        this.eventLink = event.htmlLink!;
    }
}
