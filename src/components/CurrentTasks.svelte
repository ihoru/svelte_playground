<script lang="ts">
    import Task from "../models/task";
    import {tick} from "svelte";

    function randomId(length = 10) {
        return Math.random().toString(36).substring(2, length + 2);
    }

    export let tasks: Array<Task> = [];
    $: {
        console.log("tasks updated", tasks);
        localStorage.setItem("tasks", JSON.stringify(tasks));
    }

    let taskRefs: Map<string, HTMLInputElement> = new Map();
    const canUndo = false, canRedo = false;// TODO:
    const undo = () => null;// TODO:
    const redo = undo;
    // const {undo, redo, canUndo, canRedo} = useRefHistory(tasks, {
    //     deep: true,
    //     capacity: 10,
    // });

    $: console.log("tasks updated", tasks);

    function findRef(el: Element | null) {
        if (el) {
            for (let taskId in taskRefs) {
                if (taskRefs[taskId] === el) {
                    return tasks.find(task => task.id === taskId);
                    // return tasks.find(task => task.id === taskId) as Task;
                }
            }
        }
        return null;
    }

    async function tasksReorder() {
        let task: Task | null = findRef(document.activeElement);
        tasks = tasks.sort(function (taskA: Task, taskB: Task) {
            if (!taskA.done && taskB.done) {
                return 1;
            }
            if (taskA.done && !taskB.done) {
                return -1;
            }
            return 0;
        });
        if (task) {
            await tick();
            taskRefs[task!.id].focus();
        }
    }

    function taskCheck(task: Task, index: number, focus: boolean = false) {
        task.done = !task.done;
        tasks = tasks;
    }

    function taskDelete(task: Task, index: number, focus: boolean = false) {
        tasks.splice(index, 1);
        tasks = tasks;
        // TODO: focus previous or a new task
        // console.log(history)
    }

    async function taskMoveUp(task: Task, index: number, focus: boolean = false) {
        if (index === 0) {
            return;
        }
        tasks[index] = tasks[index - 1];
        tasks[index - 1] = task;
        tasks = tasks;
        if (focus) {
            await tick();
            taskRefs[task.id].focus();
        }
    }

    async function taskMoveDown(task: Task, index: number, focus: boolean = false) {
        if (index + 1 === tasks.length) {
            return;
        }
        tasks[index] = tasks[index + 1];
        tasks[index + 1] = task;
        tasks = tasks;
        if (focus) {
            await tick();
            taskRefs[task.id].focus();
        }
    }

    async function taskMoveTop(task: Task, index: number, focus: boolean = false) {
        // TODO: if current task is done prevent moving above other done tasks
        console.log("taskMoveTop");

        if (index === 0) {
            return;
        }
        tasks.splice(index, 1);
        tasks = [task, ...tasks];
        if (focus) {
            await tick();
            taskRefs[task.id].focus();
        }
    }

    async function taskMoveBottom(task: Task, index: number, focus: boolean = false) {
        console.log("taskMoveBottom");
        if (index + 1 === tasks.length) {
            return;
        }
        tasks.splice(index, 1);
        tasks.push(task);
        tasks = tasks;
        if (focus) {
            await tick();
            taskRefs[task.id].focus();
        }
    }

    function taskFocusUp(index: number) {
        if (index === 0) {
            return;
        }
        const task = tasks[index - 1];
        taskRefs[task.id].focus();
    }

    function taskFocusDown(index: number) {
        if (index + 1 === tasks.length) {
            return;
        }
        const task = tasks[index + 1];
        taskRefs[task.id].focus();
    }

    async function taskAdd(index: number) {
        const task = new Task(randomId(), "");
        tasks.splice(index, 0, task);
        tasks = tasks;
        await tick();
        taskRefs[task.id].focus();
    }

    function taskPaste(task: Task, index: number, event: ClipboardEvent) {
        index += 1;
        const text = event.clipboardData?.getData("text/plain");
        if (text) {
            const lines = text.split("\n");
            if (lines.length > 1) {
                const tasksToAdd = lines.map(line => new Task(randomId(), line.trim()));
                tasks.splice(index, 0, ...tasksToAdd);
                tasks = tasks;
                tick().then(function () {
                    taskRefs[tasksToAdd[0].id].focus();
                });
                event.preventDefault();
                event.stopPropagation();
            }
        }
    }

    function taskInputKey(task: Task, index: number, event: KeyboardEvent) {
        console.log("taskInputKey", event);
        const onlyAlt = event.altKey && !event.shiftKey && !event.ctrlKey;
        const onlyCtrl = !event.altKey && !event.shiftKey && event.ctrlKey;
        const onlyShift = !event.altKey && event.shiftKey && !event.ctrlKey;
        const noSpecial = !event.altKey && !event.shiftKey && !event.ctrlKey;
        if (noSpecial && event.key === "PageUp") {
            taskRefs[tasks[0].id].focus();
        } else if (noSpecial && event.key === "PageDown") {
            taskRefs[tasks[tasks.length - 1].id].focus();
        } else if (noSpecial && event.key === "Enter") {
            taskCheck(task, index, true);
        } else if (onlyAlt && event.key === "Delete") {
            taskDelete(task, index, true);
        } else if (onlyCtrl && event.key === "ArrowUp") {
            taskMoveUp(task, index, true);
        } else if (onlyCtrl && event.key === "ArrowDown") {
            taskMoveDown(task, index, true);
        } else if (onlyAlt && event.key === "ArrowUp") {
            taskMoveTop(task, index, true);
        } else if (onlyAlt && event.key === "ArrowDown") {
            taskMoveBottom(task, index, true);
        } else if (onlyShift && event.key === "Enter") {
            taskAdd(index);
        } else if (onlyCtrl && event.key === "Enter") {
            taskAdd(index + 1);
        } else if (noSpecial && event.key === "ArrowUp") {
            taskFocusUp(index);
        } else if (noSpecial && event.key === "ArrowDown") {
            taskFocusDown(index);
        } else {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
    }

    function appKeyUp(event: KeyboardEvent) {
        console.log("appKeyUp", event);
        if (event.ctrlKey && !event.shiftKey && !event.altKey && event.code === "KeyZ") {
            undo();
        } else if (event.ctrlKey && event.shiftKey && !event.altKey && event.code === "KeyZ") {
            redo();
        } else if (event.ctrlKey && !event.shiftKey && !event.altKey && event.code === "KeyS") {
            tasksReorder();
        } else {
            return;
        }
        event.preventDefault();
    }

</script>

<svelte:document on:keyup="{appKeyUp}"></svelte:document>

<h1>My tasks for today </h1>
<div class="history">
    <button disabled="{!canUndo}" on:click="{undo}" tabindex="-1">&laquo; undo</button>
    <button disabled="{!canRedo}" on:click="{redo}" tabindex="-1">redo &raquo;</button>
    |
    <button on:click="{tasksReorder}" tabindex="-1">sort</button>
    <button on:click="{() => taskAdd(tasks.length)}" tabindex="-1">add</button>
</div>
<ul>
    {#each tasks as task, index (task.id)}
        <li
                class="task"
                class:done="{task.done}"
        >
            <div class="actions">
                <input type="checkbox" tabindex="-1"
                       bind:checked="{task.done}"
                >
                <button tabindex="-1"
                        on:click="{() => taskDelete(task, index)}"
                >&cross;
                </button>
                <button tabindex="-1"
                        on:click="{() => taskMoveUp(task, index)}"
                >&uparrow;
                </button>
                <button tabindex="-1"
                        on:click="{() => taskMoveDown(task, index)}"
                >&downarrow;
                </button>
                <button tabindex="-1"
                        on:click="{() => taskMoveTop(task, index)}"
                >&upuparrows;
                </button>
                <button tabindex="-1"
                        on:click="{() => taskMoveBottom(task, index)}"
                >&downdownarrows;
                </button>
            </div>
            <div class="content">
                <input bind:this="{taskRefs[task.id]}"
                       bind:value="{task.title}"
                       on:keydown="{(event) => taskInputKey(task, index, event)}"
                       on:paste="{(event) => taskPaste(task, index, event)}"
                       tabindex="{task.done ? -1 : 0}"
                />
            </div>
        </li>
    {/each}
</ul>

<style>
    ul {
        padding: 0;
        list-style: none;
    }


    h1,
    .history {
        text-align: center;
    }

    .task {
        margin: 2px;
        padding: 5px;
        border: 1px solid #ccc;
        display: flex;
    }

    .task .actions {
        flex: 1;
    }

    .task > * {
        display: flex;
        justify-content: space-evenly;
    }

    .task .content {
        flex: 2;
    }

    .task .content input {
        width: 100%;
        border: 1px solid #eee;
        padding: 3px;
    }

    .task.done {
        opacity: .5;
    }

</style>

