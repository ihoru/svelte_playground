import { randomId } from "../lib/utils";

export default class Task {
    constructor(
        public title: string = "",
        public duration: number | null = null,
        public todoistTaskId: string = "",
        public todoistPriority: number = 0,
        public todoistCompleted: boolean = false,
        public number: number | null = null,
        public id: string = randomId(),
        public startTime: string | null = null,
        public finishTime: string | null = null,
        public done: boolean = false,
    ) {
    }

    getUrl() {
        if (!this.todoistTaskId) {
            return;
        }
        return `https://todoist.com/showTask?id=${this.todoistTaskId}`;
    }
}
