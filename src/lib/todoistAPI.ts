export interface Due {
    is_recurring: boolean;
    string: string;
    date: string;
    datetime: string;
    timezone: string;
}

export interface Duration {
    amount: number;
    unit: "minute" | "day";
}

export interface TodoistTask {
    id: string;
    assigner_id: null;
    assignee_id: null;
    project_id: string;
    section_id: null;
    parent_id: null;
    order: number;
    content: string;
    description: string;
    is_completed: boolean;
    labels: string[];
    priority: number;
    comment_count: number;
    creator_id: string;
    created_at: string;
    due?: Due;
    duration?: Duration;
    url: string;
}

export class TodoistAPI {
    constructor(private token: string) {
        console.log(`Todoist ${token}`);
    }

    async getTasks(when: "today" | "tomorrow" = "today") {
        const filter = `(${when} | overdue) & (assigned to:me | !assigned)`;
        const data = await this._fetch<Array<TodoistTask>>(`tasks?filter=${encodeURIComponent(filter)}`);
        data.sort(this._sortTasks);
        return data;
    }

    getTask(taskId: string) {
        return this._fetch<TodoistTask>(`tasks/${taskId}`);
    }

    complete(taskId: string): Promise<boolean> {
        return this._fetch(`tasks/${taskId}/close`, {method: "POST"});
    }

    reopen(taskId: string): Promise<boolean> {
        return this._fetch(`tasks/${taskId}/reopen`, {method: "POST"});
    }

    async postpone(taskId: string, dueDate: string, task: TodoistTask = null) {
        if (!task) {
            task = await this.getTask(taskId);
            if (!task || !task.due || task.is_completed) {
                return;
            }
        }
        // get current data, to preserve "is_recurring" state and time
        const payload = {};
        if (task.due.is_recurring) {
            payload["due_string"] = task.due.string;
        }
        if (task.due.datetime) {
            payload["due_datetime"] = `${dueDate}T${task.due.datetime.split("T")[1]}`;
        } else {
            payload["due_date"] = dueDate;
        }
        return this._fetch(`tasks/${taskId}`, {body: payload});
    }

    private async _fetch<T>(path: string, params = {}): Promise<T> {
        const url = `https://api.todoist.com/rest/v2/${path}`;
        if (params["body"]) {
            params["body"] = JSON.stringify(params["body"]);
            params["method"] ??= "POST";
        }
        params["headers"] ??= {};
        params["headers"]["Content-type"] = "application/json";
        params["headers"]["Authorization"] = `Bearer ${this.token}`;
        console.debug("Todoist request", url, params);
        const response = await fetch(url, params);
        if (!response.ok) {
            throw new Error(response.statusText);
        }
        const content = await response.text();
        console.debug("Todoist response", content);
        return content ? JSON.parse(content) : true;
    }

    private _sortTasks(a: TodoistTask, b: TodoistTask) {
        const aDue = a.due.datetime ? new Date(a.due.datetime) : null;
        const bDue = b.due.datetime ? new Date(b.due.datetime) : null;
        if ((aDue && !bDue) || (aDue && bDue && aDue < bDue)) {
            return -1;
        } else if ((bDue && !aDue) || (aDue && bDue && aDue > bDue)) {
            return 1;
        }
        if (a.priority > b.priority) {
            return -1;
        } else if (a.priority < b.priority) {
            return 1;
        }
        if (a.order < b.order) {
            return -1;
        } else if (a.order > b.order) {
            return 1;
        }
        return 0;
    }
}
