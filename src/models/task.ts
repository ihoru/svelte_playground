class Task {
  constructor(
      public title: string = "",
      public duration: number | null = null,
      public id: string = crypto.randomUUID(),
      public startTime: string = "",
      public finishTime: string = "",
      public todoistTaskId: string = "",
      public done: boolean = false,
  ) {
  }
}

export default Task;
