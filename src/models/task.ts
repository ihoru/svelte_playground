export default class Task {
    constructor(
        public title: string = "",
        public duration: number | null = null,
        public todoistTaskId: string = "",
        public number: number | null = null,
        public id: string = crypto.randomUUID(),
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
