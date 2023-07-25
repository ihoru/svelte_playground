class Task {
  constructor(
      public title: string = "",
      public duration: number | null = null,
      public number: number | null = null,
      public id: string = crypto.randomUUID(),
      public startTime: string | null = null,
      public finishTime: string | null = null,
      public todoistTaskId: string = "",
      public done: boolean = false,
  ) {
  }
}

export default Task;
