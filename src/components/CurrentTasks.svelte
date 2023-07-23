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

    const saveDebounced = debounce((t) => {
        save(t);
    }, 1000);

    function tasksUpdated(newTasks) {
        console.log("tasks updated", newTasks);
        recalculateTimes(newTasks);
        tasks = newTasks;
        saveDebounced(newTasks);
    }

    function recalculateTimes(tasks) {
        let lastTask: Task;
        let startAt = new Date();
        startAt = addMinutes(startAt, 5 - startAt.getMinutes() % 5);
        const gap = 5; // minutes
        let now = startAt;
        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            const duration = parseInt(task.duration);
            if (task.done || !duration || duration <= 0) {
                continue;
            }
            task.startTime = format(now, "HH:mm");
            now = addMinutes(now, duration);
            task.finishTime = format(now, "HH:mm");
            now = addMinutes(now, gap);
        }
    }

    async function tasksReorder() {
        const focusedAt = document.activeElement;
        const refs = focusedAt?.classList.contains("title") ? taskTitleRefs : taskDurationRefs;
        // noinspection JSUnresolvedReference
        const focusedTaskId = focusedAt?.dataset.taskId;
        tasks = tasks.sort(function (taskA: Task, taskB: Task) {
            if (!taskA.done && taskB.done) {
                return 1;
            }
            if (taskA.done && !taskB.done) {
                return -1;
            }
            return 0;
        });
        if (focusedTaskId) {
            await tick();
            refs[focusedTaskId].focus();
        }
    }

    function appKeyUp(event: KeyboardEvent) {
        // console.log("appKeyUp", event);
        if (event.ctrlKey && !event.shiftKey && !event.altKey && event.code === "KeyZ") {
            undo();
        } else if (event.ctrlKey && event.shiftKey && !event.altKey && event.code === "KeyZ") {
            redo();
        } else if (event.ctrlKey && !event.shiftKey && event.altKey && event.code === "KeyS") {
            tasksReorder();
        } else {
            return;
        }
        event.preventDefault();
    }

    const taskActions = {
        toggle(task: Task, index: number) {
            task.done = !task.done;
            tasks = tasks;
        },

        delete(task: Task, index: number) {
            tasks.splice(index, 1);
            tasks = tasks;
        },

        moveUp(task: Task, index: number) {
            if (index === 0) {
                return;
            }
            tasks[index] = tasks[index - 1];
            tasks[index - 1] = task;
            tasks = tasks;
        },

        moveDown(task: Task, index: number) {
            if (index + 1 === tasks.length) {
                return;
            }
            tasks[index] = tasks[index + 1];
            tasks[index + 1] = task;
            tasks = tasks;
        },

        moveTop(task: Task, index: number) {
            if (index === 0) {
                return;
            }
            let newIndex = 0;
            for (let i = index - 1; i >= 0; i--) {
                if (tasks[i].done) {
                    newIndex = i + 1;
                    break;
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

        add(index: number) {
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

        async inputKey(task: Task, index: number, event: KeyboardEvent, ref: HTMLInputElement) {
            // console.log("taskInputKey", event, ref);
            const onlyAlt = event.altKey && !event.shiftKey && !event.ctrlKey;
            const onlyCtrl = !event.altKey && !event.shiftKey && event.ctrlKey;
            const onlyShift = !event.altKey && event.shiftKey && !event.ctrlKey;
            const noSpecial = !event.altKey && !event.shiftKey && !event.ctrlKey;
            const inputType = ref.classList.contains("title") ? "title" : "duration";
            let focusOn;
            let focusTask: Task | null;
            if (noSpecial && event.key === "PageUp") {
                focusTask = tasks[0];
            } else if (noSpecial && event.key === "PageDown") {
                focusTask = tasks[tasks.length - 1];
            } else if (noSpecial && event.key === "ArrowUp") {
                if (index) {
                    focusTask = tasks[index - 1];
                }
            } else if (noSpecial && event.key === "ArrowDown") {
                if (index + 1 < tasks.length) {
                    focusTask = tasks[index + 1];
                }
            } else if (noSpecial && event.key === "Enter") {
                this.toggle(task, index);
            } else if (onlyAlt && event.key === "Delete") {
                this.delete(task, index);
                if (index == tasks.length) {
                    --index;
                }
                focusTask = tasks[index];
            } else if (onlyCtrl && event.key === "ArrowUp") {
                this.moveUp(task, index);
                focusOn = ref;
            } else if (onlyCtrl && event.key === "ArrowDown") {
                this.moveDown(task, index);
                focusOn = ref;
            } else if (onlyAlt && event.key === "ArrowUp") {
                this.moveTop(task, index);
                focusOn = ref;
            } else if (onlyAlt && event.key === "ArrowDown") {
                this.moveBottom(task, index);
                focusOn = ref;
            } else if (onlyShift && event.key === "Enter") {
                focusTask = this.add(index);
            } else if (onlyCtrl && event.key === "Enter") {
                focusTask = this.add(index + 1);
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

    $: tasksUpdated(tasks);
</script>

<svelte:document on:keyup="{appKeyUp}"></svelte:document>
<svelte:window on:beforeunload="{() => save(tasks)}"></svelte:window>

<h1>My tasks for today </h1>
<div class="history">
    <button disabled="{!canUndo}" on:click="{undo}" tabindex="-1">&laquo; undo</button>
    <button disabled="{!canRedo}" on:click="{redo}" tabindex="-1">redo &raquo;</button>
    |
    <button on:click="{tasksReorder}" tabindex="-1">sort</button>
    <button on:click="{() => taskActions.add(tasks.length)}" tabindex="-1">add</button>
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

