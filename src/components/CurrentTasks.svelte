<script lang="ts">
    import Task from "../models/task";
    import TaskElement from "./Task.svelte";
    import {tick} from "svelte";
    import addMinutes from "date-fns/addMinutes";
    import format from "date-fns/format";
    import debounce from "lodash/debounce";

    export let tasks: Array<Task> = [];
    export let save: (tasks: Array<Task>) => void = (tasks: Array<Task>) => null;

    const taskTitleRefs: Map<string, HTMLInputElement> = new Map();
    const taskDurationRefs: Map<string, HTMLInputElement> = new Map();
    const canUndo = false, canRedo = false;// TODO:
    const undo = () => null;// TODO:
    const redo = undo;
    // const {undo, redo, canUndo, canRedo} = useRefHistory(tasks, {
    //     deep: true,
    //     capacity: 10,
    // });
    let lastActiveElement;
    let lastTasksJSON;

    const saveDebounced = debounce(() => {
        save(tasks);
    }, 1000);

    function tasksUpdated() {
        console.log("tasks updated", tasks);
        recalculateTimes();
        recalculateNumbers();
        const tmp = JSON.stringify(tasks);
        if (tmp !== lastTasksJSON) {
            lastTasksJSON = tmp;
            saveDebounced();
        }
    }

    function recalculateTimes() {
        let lastTask: Task;
        let startAt = new Date();
        startAt = addMinutes(startAt, 5 - startAt.getMinutes() % 5);
        const gap = 5; // minutes
        let now = startAt;
        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            const duration = parseInt(task.duration);
            if (task.done || !duration || duration <= 0) {
                if (!task.done) {
                    task.startTime = task.finishTime = "";
                }
                continue;
            }
            task.startTime = format(now, "HH:mm");
            now = addMinutes(now, duration);
            task.finishTime = format(now, "HH:mm");
            now = addMinutes(now, gap);
        }
    }

    async function tasksReorder(index) {
        const focusedAt = document.activeElement;
        const refs = focusedAt?.classList.contains("title") ? taskTitleRefs : taskDurationRefs;
        tasks = tasks.sort(function (taskA: Task, taskB: Task) {
            if (!taskA.done && taskB.done) {
                return 1;
            }
            if (taskA.done && !taskB.done) {
                return -1;
            }
            return 0;
        });
        if (focusedAt) {
            await tick();
            if (index == tasks.length) {
                --index;
            }
            refs[tasks[index].id].focus();
        }
    }

    async function addTaskToTheEnd() {
        const task = taskActions.add(tasks.length);
        await tick();
        taskTitleRefs[task.id].focus();
    }

    function recalculateNumbers() {
        let number = 0;
        for (const t of tasks) {
            if (t.done || !t.duration && !t.title) {
                t.number = null;
            } else {
                t.number = ++number;
            }
        }
    }

    function appKeyUp(event: KeyboardEvent) {
        console.debug("appKeyUp", event);
        const activeElement = document.activeElement;
        if (event.ctrlKey && !event.shiftKey && !event.altKey && event.code === "KeyZ") {
            undo();
        } else if (event.ctrlKey && event.shiftKey && !event.altKey && event.code === "KeyZ") {
            redo();
        } else if (!event.ctrlKey && !event.shiftKey && !event.altKey && event.key === "Enter") {
            addTaskToTheEnd();
        } else if (!event.ctrlKey && !event.shiftKey && !event.altKey && event.code === "Escape") {
            if (!lastActiveElement && tasks.length) {
                lastActiveElement = taskTitleRefs[tasks[tasks.length - 1].id];
            }
            if (activeElement && activeElement.tagName === "INPUT") {
                activeElement.blur();
                lastActiveElement = activeElement;
            } else if (lastActiveElement) {
                lastActiveElement.focus();
                lastActiveElement = null;
            }
        } else {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
    }

    const taskActions = {
        toggle(task: Task, index: number) {
            task.done = !task.done;
            if (task.done && !task.duration && !task.title) {
                tasks.splice(index, 1);
            }
            tasksReorder(index);
        },

        delete(task: Task, index: number) {
            tasks.splice(index, 1);
            tasks = tasks;
        },

        moveUp(task: Task, index: number, size = 1) {
            if (index === 0) {
                return;
            }
            const newIndex = Math.max(0, index - size);
            tasks[index] = tasks[newIndex];
            tasks[newIndex] = task;
            tasks = tasks;
        },

        moveDown(task: Task, index: number, size = 1) {
            if (index + 1 === tasks.length) {
                return;
            }
            const newIndex = Math.min(tasks.length - 1, index + size);
            tasks[index] = tasks[newIndex];
            tasks[newIndex] = task;
            tasks = tasks;
        },

        moveTop(task: Task, index: number) {
            if (index === 0) {
                return;
            }
            let newIndex = 0;
            if (!tasks[index - 1].done) {
                for (let i = index - 1; i >= 0; i--) {
                    if (tasks[i].done) {
                        newIndex = i + 1;
                        break;
                    }
                }
            }
            tasks.splice(index, 1);
            tasks.splice(newIndex, 0, task);
            tasks = tasks;
        },

        moveBottom(task: Task, index: number) {
            if (index + 1 === tasks.length) {
                return;
            }
            tasks.splice(index, 1);
            tasks.push(task);
            tasks = tasks;
        },

        add(index: number = null) {
            if (!index) {
                tasks.length;
            }
            const task = new Task();
            tasks.splice(index, 0, task);
            tasks = tasks;
            return task;
        },

        async paste(task: Task, index: number, event: ClipboardEvent) {
            index += 1;
            const text = event.clipboardData?.getData("text/plain");
            if (text) {
                const lines = text.split("\n");
                if (lines.length > 1) {
                    const tasksToAdd = lines.map(
                        line => line.trim(),
                    ).filter(
                        line => line.length > 0,
                    ).map(line => {
                        let v = line.split("\t");
                        let title, duration;
                        if (v.length === 1) {
                            title = v[0];
                        } else {
                            duration = v[0];
                            title = v[1];
                        }
                        return new Task(title, duration);
                    });
                    tasks.splice(index, 0, ...tasksToAdd);
                    tasks = tasks;
                    event.preventDefault();
                    event.stopPropagation();
                    await tick();
                    taskTitleRefs[tasksToAdd[0].id].focus();
                }
            }
        },

        async inputKeyDown(task: Task, index: number, event: KeyboardEvent, ref: HTMLInputElement) {
            // keydown event, so we can prevent default of (de)incrementing input type=number
            console.debug("inputKeyDown", event);
            const onlyAlt = event.altKey && !event.shiftKey && !event.ctrlKey;
            const onlyCtrl = !event.altKey && !event.shiftKey && event.ctrlKey;
            const onlyShift = !event.altKey && event.shiftKey && !event.ctrlKey;
            const noSpecial = !event.altKey && !event.shiftKey && !event.ctrlKey;
            const inputType = ref.classList.contains("title") ? "title" : "duration";
            let focusOn;
            let focusTask: Task | null;
            if (["ArrowUp", "ArrowDown", "PageUp", "PageDown"].includes(event.key)) {
                event.preventDefault();
            }
            const jumpSize = 5;
            if (noSpecial && event.key === "ArrowUp" && index) {
                focusTask = tasks[index - 1];
            } else if (noSpecial && event.key === "ArrowDown" && index + 1 < tasks.length) {
                focusTask = tasks[index + 1];
            } else if (noSpecial && event.key === "PageUp") {
                focusTask = tasks[Math.max(0, index - jumpSize)];
            } else if (noSpecial && event.key === "PageDown") {
                focusTask = tasks[Math.min(tasks.length - 1, index + jumpSize)];
            } else if (onlyShift && event.key === "ArrowUp") {
                this.moveUp(task, index);
            } else if (onlyShift && event.key === "ArrowDown") {
                this.moveDown(task, index);
            } else if (onlyShift && event.key === "PageUp") {
                this.moveUp(task, index, jumpSize);
            } else if (onlyShift && event.key === "PageDown") {
                this.moveDown(task, index, jumpSize);
            } else if (onlyAlt && event.key === "ArrowUp") {
                this.moveTop(task, index);
            } else if (onlyAlt && event.key === "ArrowDown") {
                this.moveBottom(task, index);
            } else {
                return;
            }
            focusOn = ref;
            if (focusTask) {
                await tick();
                focusOn = inputType === "title" ? taskTitleRefs[focusTask.id] : taskDurationRefs[focusTask.id];
            }
            if (focusOn) {
                if (!focusTask) {
                    await tick();
                }
                focusOn.focus();
            }
        },

        async inputKeyUp(task: Task, index: number, event: KeyboardEvent, ref: HTMLInputElement) {
            console.debug("inputKeyUp", event);
            const onlyAlt = event.altKey && !event.shiftKey && !event.ctrlKey;
            const onlyCtrl = !event.altKey && !event.shiftKey && event.ctrlKey;
            const onlyShift = !event.altKey && event.shiftKey && !event.ctrlKey;
            const noSpecial = !event.altKey && !event.shiftKey && !event.ctrlKey;
            const inputType = ref.classList.contains("title") ? "title" : "duration";
            let focusOn;
            let focusTask: Task | null;
            if (event.key === "Delete" && (onlyAlt || noSpecial && !task.duration && !task.title)) {
                this.delete(task, index);
                if (index == tasks.length) {
                    --index;
                }
                focusTask = tasks[index];
            } else if (noSpecial && event.key === "ArrowLeft" && inputType === "title" && !task.title) {
                focusOn = taskDurationRefs[task.id];
            } else if (noSpecial && event.key === "ArrowRight" && inputType === "duration" && !task.duration) {
                focusOn = taskTitleRefs[task.id];
            } else if (noSpecial && event.key === "Enter") {
                this.toggle(task, index);
            } else if (onlyCtrl && event.key === "Enter") {
                focusTask = this.add(index + 1);
            } else if (onlyAlt && event.key === "PageUp" && tasks.length) {
                focusTask = tasks.find((t: Task) => {
                    if (!t.done) {
                        return t;
                    }
                }) || tasks[0];
            } else if (onlyAlt && event.key === "PageDown" && tasks.length) {
                focusTask = tasks[tasks.length - 1];
            } else if (onlyShift && event.key === "Enter") {
                focusTask = this.add(index);
            } else {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            if (focusTask) {
                await tick();
                focusOn = inputType === "title" ? taskTitleRefs[focusTask.id] : taskDurationRefs[focusTask.id];
            }
            if (focusOn) {
                if (!focusTask) {
                    await tick();
                }
                focusOn.focus();
            }
        },

        updated() {
            tasks = tasks;
        },
    };

    $: tasks && tasksUpdated();
</script>

<svelte:document on:keyup="{appKeyUp}"></svelte:document>
<svelte:window on:beforeunload="{() => save(tasks)}"></svelte:window>

<h1>My tasks for today </h1>
<div class="history">
    <button disabled="{!canUndo}" on:click="{undo}" tabindex="-1">&laquo; undo</button>
    <button disabled="{!canRedo}" on:click="{redo}" tabindex="-1">redo &raquo;</button>
    |
    <button on:click="{addTaskToTheEnd}" tabindex="-1">add</button>
</div>
<ul>
    {#each tasks as task, index (task.id)}
        <TaskElement
                bind:refDuration="{taskDurationRefs[task.id]}"
                bind:refTitle="{taskTitleRefs[task.id]}"
                {task}
                {index}
                actions="{taskActions}"
        />
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

</style>
