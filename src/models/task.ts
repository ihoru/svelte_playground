class Task {
  constructor(
      public title: string = "",
      public id: string = crypto.randomUUID(),
      public duration: number | null = null,
      public todoistTaskId: string = "",
      public done: boolean = false,
  ) {
  }
}

export default Task;
