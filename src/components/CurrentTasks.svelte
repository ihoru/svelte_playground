<script lang="ts">
    import * as utils from "../lib/utils";
    import CurrentTask from "./CurrentTask.svelte";
    import Fa from "svelte-fa/src/fa.svelte";
    import Task from "../models/task";
    import addDays from "date-fns/addDays";
    import addMinutes from "date-fns/addMinutes";
    import isPast from "date-fns/isPast";
    import parseISO from "date-fns/parseISO";
    import type {TodoistTask} from "../lib/todoistAPI";
    import {TodoistAPI} from "../lib/todoistAPI";
    import {faAdd} from "@fortawesome/free-solid-svg-icons/faAdd";
    import {faCircleCheck} from "@fortawesome/free-regular-svg-icons/faCircleCheck";
    import {faClock} from "@fortawesome/free-regular-svg-icons/faClock";
    import {faDownload} from "@fortawesome/free-solid-svg-icons/faDownload";
    import {faNotEqual} from "@fortawesome/free-solid-svg-icons/faNotEqual";
    import {faXmark} from "@fortawesome/free-solid-svg-icons/faXmark";
    import {flip} from "svelte/animate";
    import {md5} from "pure-md5";
    import {tick} from "svelte";
    import {faArrowDownAZ} from "@fortawesome/free-solid-svg-icons/faArrowDownAZ";

    export let ignoreNextTasksUpdate: boolean = false;
    export let tasks: Array<Task> = [];
    export let save: (tasks: Array<Task>) => void = (tasks: Array<Task>) => null;
    export let showActiveTasksOnly = localStorage.getItem("showActiveTasksOnly") !== "false";

    $: localStorage.setItem("showActiveTasksOnly", showActiveTasksOnly);
    $: displayTasks = tasks.filter((task: Task) => showActiveTasksOnly && !task.done && !task.postponed || !showActiveTasksOnly);

    const taskTitleRefs: Map<string, HTMLInputElement> = new Map();
    const taskDurationRefs: Map<string, HTMLInputElement> = new Map();
    const canUndo = false, canRedo = false;// TODO:
    const undo = () => null;// TODO:
    const redo = undo;
    // const {undo, redo, canUndo, canRedo} = useRefHistory(tasks, {
    //     deep: true,
    //     capacity: 10,
    // });
    let lastActiveElement: HTMLInputElement;
    let lastTasksHash: string;

    const todoistAccessToken = import.meta.env.MY_TODOIST_ACCESS_TOKEN || "";
    const todoistAPI = todoistAccessToken ? new TodoistAPI(todoistAccessToken) : null;
    let loading = false;

    let saveTimeout;

    function debouncedSave() {
        if (saveTimeout) {
            clearTimeout(saveTimeout);
        }
        saveTimeout = setTimeout(() => {
            save(tasks);
        }, 2000);
    }

    function saveIfDebounced() {
        if (saveTimeout) {
            clearTimeout(saveTimeout);
            save(tasks);
        }
    }

    function tasksUpdated() {
        console.log("tasks updated", tasks);
        recalculateTimes();
        recalculateNumbers();
        const hash = md5(JSON.stringify(tasks));
        if (hash === lastTasksHash) {
            return;
        }
        lastTasksHash = hash;
        if (!ignoreNextTasksUpdate) {
            debouncedSave();
        }
        ignoreNextTasksUpdate = false;
    }

    function recalculateTimes() {
        let startAt = new Date();
        const gap = parseInt(import.meta.env.MY_GAP_BETWEEN_TASKS_MINUTES) || 0;
        if (gap > 0) {
            startAt = addMinutes(startAt, gap - startAt.getMinutes() % gap);
        }
        let now = startAt;
        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            const duration = task.duration;
            if (task.done || task.postponed || !duration || duration <= 0) {
                if (!task.done) {
                    task.startTime = task.finishTime = null;
                }
                continue;
            }
            task.startTime = utils.timeFormat(now);
            now = addMinutes(now, duration);
            task.finishTime = utils.timeFormat(now);
            now = addMinutes(now, gap);
        }
    }

    async function tasksReorder(index: number = null) {
        if (showActiveTasksOnly) {
            return;
        }
        resetLastMoveTopMemory();
        const focusedAt = document.activeElement;
        let refs;
        if (focusedAt.tagName === "INPUT" && index !== null) {
            const classList = focusedAt.classList;
            if (classList.contains("duration")) {
                refs = taskDurationRefs;
            } else if (classList.contains("title")) {
                refs = taskTitleRefs;
            }
        }
        tasks = tasks.sort(function (taskA: Task, taskB: Task) {
            if (!taskA.done && taskB.done) {
                return 1;
            }
            if (taskA.done && !taskB.done) {
                return -1;
            }
            if (!taskA.postponed && taskB.postponed) {
                return -1;
            }
            if (taskA.postponed && !taskB.postponed) {
                return 1;
            }
            return 0;
        });
        if (refs) {
            await tick();
            if (index == tasks.length) {
                --index;
            }
            refs[tasks[index].id].focus();
        }
    }

    function findTask(taskId) {
        return tasks.find((task) => task.id === taskId);
    }

    async function addTaskToTheEnd() {
        let index = 0;
        for (let i = tasks.length - 1; i >= 0; --i) {
            if (!tasks[i].postponed) {
                index = i;
                break;
            }
        }
        const task = taskActions.add(index + 1);
        await tick();
        taskTitleRefs[task.id].focus();
    }

    function clearAllTasks() {
        if (!confirm("Clear all?")) {
            return;
        }
        tasks = [];
    }

    function clearPostponedTasks() {
        if (!confirm("Clear postponed?")) {
            return;
        }
        tasks = tasks.filter((task: Task) => !task.postponed);
    }

    function clearDoneTasks() {
        if (!confirm("Clear done?")) {
            return;
        }
        tasks = tasks.filter((task: Task) => !task.done);
    }

    function clearExternalTasks() {
        if (!confirm("Clear imported?")) {
            return;
        }
        tasks = tasks.filter((task: Task) => !task.todoistTaskId);
    }

    async function fetchTodoistTasks() {
        loading = true;
        let todoistTasks;
        try {
            todoistTasks = await todoistAPI.getTasks();
        } catch (e) {
            console.error(e);
            alert("Error fetching tasks from Todoist");
            return;
        } finally {
            loading = false;
        }
        console.log("todoistTasks", todoistTasks);
        let taskUpdated = false;
        const searchDuration = /( \d{1,2}[mh])$/i;
        const taskIds = [];
        const tasksToAdd = todoistTasks.map(
            (task: TodoistTask) => {
                let title = task.content;
                const todoistTaskId = task.id;
                const todoistPriority = task.priority;
                if (
                    title.startsWith("*") ||
                    title.endsWith("~") ||
                    task.labels.indexOf("noplan") !== -1
                ) {
                    return;
                }
                taskIds.push(todoistTaskId);
                let duration;
                if (task.duration) {
                    duration = task.duration.amount;
                } else {
                    const hasDuration = title.match(searchDuration);
                    if (hasDuration) {
                        title = title.slice(0, title.length - hasDuration[0].length);
                        duration = hasDuration[0].trim();
                        let multiplier = 1;
                        const lastCharacter = duration[duration.length - 1];
                        if (lastCharacter === "h") {
                            multiplier = 60;
                            duration = duration.slice(0, duration.length - 1);
                        } else if (lastCharacter === "m") {
                            duration = duration.slice(0, duration.length - 1);
                        }
                        duration = parseInt(duration) * multiplier;
                    }
                }
                const existingTask = tasks.find((task: Task) => task.todoistTaskId == todoistTaskId);
                if (existingTask) {
                    const durationChanged = !existingTask.duration && duration && existingTask.duration !== duration;
                    if (
                        existingTask.done
                        || existingTask.postponed
                        || existingTask.todoistCompleted
                        || existingTask.title !== title
                        || durationChanged
                        || existingTask.todoistPriority !== todoistPriority
                    ) {
                        existingTask.done = false;
                        existingTask.postponed = false;
                        existingTask.title = title;
                        if (durationChanged) {
                            existingTask.duration = duration;
                        }
                        existingTask.todoistPriority = todoistPriority;
                        existingTask.todoistCompleted = false;
                        taskUpdated = true;
                    }
                    return;
                }
                return new Task(title, duration, todoistTaskId, todoistPriority);
            },
        ).filter(Boolean);
        tasks.forEach((task: Task) => {
            if (!task.todoistTaskId) {
                return;
            }
            if (!task.postponed && !task.done && !taskIds.includes(task.todoistTaskId)) {
                task.postponed = true;
                taskUpdated = true;
            }
        });
        if (!tasksToAdd.length) {
            if (taskUpdated) {
                await tasksReorder();
            }
            alert("No tasks found in Todoist");
            return;
        }
        tasks.splice(tasks.length, 0, ...tasksToAdd);
        await tasksReorder();
    }

    function recalculateNumbers() {
        let number = 0;
        for (const t of tasks) {
            if (t.done || t.postponed || !t.duration && !t.title) {
                t.number = null;
            } else {
                t.number = ++number;
            }
        }
    }

    function appKeyUp(event: KeyboardEvent) {
        console.debug("appKeyUp", event);
        const activeElement: HTMLInputElement = document.activeElement as HTMLInputElement;
        if (event.ctrlKey && !event.shiftKey && !event.altKey && event.code === "KeyZ") {
            undo();
        } else if (event.ctrlKey && event.shiftKey && !event.altKey && event.code === "KeyZ") {
            redo();
        } else if (!event.ctrlKey && !event.shiftKey && !event.altKey && event.key === "Enter") {
            addTaskToTheEnd();
        } else if (!event.ctrlKey && !event.shiftKey && !event.altKey && event.code === "Escape") {
            if (!lastActiveElement && tasks.length) {
                const firstTask = tasks.find((t: Task) => !t.done) || tasks[0];
                lastActiveElement = taskTitleRefs[firstTask.id];
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

    async function createTodoistTask(task: Task, dueDate: string) {
        let title = task.title;
        if (task.duration) {
            title += ` ${task.duration}m`;
        }
        const todoistTask = await todoistAPI.create(title, dueDate);
        task.todoistTaskId = todoistTask.id;
        task.todoistPriority = todoistTask.priority;
        tasks = tasks;
    }

    let activeDropZoneIndex: number;
    let draggingTaskId: string = null;
    let lastMoveTopAt: Date;
    let lastMoveTopIndex: number;

    function resetLastMoveTopMemory() {
        lastMoveTopAt = lastMoveTopIndex = null;
    }

    const taskActions = {
        async toggle(task: Task, index: number) {
            resetLastMoveTopMemory();
            task.done = !task.done;
            await tasksReorder(index);
            if (!task.done) {
                return;
            }
            if (!task.duration && !task.title) {
                // delete empty task
                tasks.splice(index, 1);
                return;
            }
            task.startTime = null;
            task.finishTime = utils.timeFormat();
            task.postponed = false;
            tasks = tasks;
            if (!task.todoistTaskId || task.todoistCompleted) {
                return;
            }
            task.todoistCompleted = true;
            const todoistTask = await todoistAPI.getTask(task.todoistTaskId);
            if (!todoistTask) {
                task.resetTodoist();
                await tasksReorder(index);
                return;
            }
            if (todoistTask.is_completed) {
                return;
            }
            const today = utils.dateFormat();
            const isDue = todoistTask.due && (todoistTask.due.date === today || isPast(parseISO(todoistTask.due.date)));
            if (isDue) {
                await todoistAPI.complete(task.todoistTaskId);
            } else if (task.postponed) {
                await todoistAPI.postpone(task.todoistTaskId, today, todoistTask);
                await todoistAPI.complete(task.todoistTaskId);
            }
        },

        delete(task: Task, index: number) {
            tasks.splice(index, 1);
            tasks = tasks;
        },

        async restore(task: Task, index: number) {
            task.postponed = false;
            await tasksReorder(index);
            const todoistTask = await todoistAPI.getTask(task.todoistTaskId);
            if (!todoistTask) {
                task.resetTodoist();
                tasks = tasks;
                return;
            }
            if (todoistTask.is_completed) {
                await todoistAPI.reopen(task.todoistTaskId);
            }
            const dueDate = utils.dateFormat();
            await todoistAPI.postpone(task.todoistTaskId, dueDate, todoistTask);
        },

        create(task: Task, index: number) {
            const dueDate = utils.dateFormat();
            createTodoistTask(task, dueDate);
            tasks = tasks;
        },

        async postponeTomorrow(task: Task) {
            task.postponed = true;
            const focusedAt = document.activeElement;
            if (focusedAt && focusedAt.tagName === "INPUT") {
                focusedAt.blur();
            }
            await tasksReorder();
            const todoistTask = await todoistAPI.getTask(task.todoistTaskId);
            if (!todoistTask) {
                task.resetTodoist();
                tasks = tasks;
                return;
            }
            if (todoistTask.is_completed) {
                return;
            }
            if (!todoistTask.due || todoistTask.due.date === utils.dateFormat() || isPast(parseISO(todoistTask.due.date))) {
                const dt = addDays(new Date(), 1);
                const dueDate = utils.dateFormat(dt);
                await todoistAPI.postpone(task.todoistTaskId, dueDate, todoistTask);
            }
        },

        async postponeSaturday(task: Task) {
            task.postponed = true;
            const focusedAt = document.activeElement;
            if (focusedAt && focusedAt.tagName === "INPUT") {
                focusedAt.blur();
            }
            await tasksReorder();
            const todoistTask = await todoistAPI.getTask(task.todoistTaskId);
            if (!todoistTask) {
                task.resetTodoist();
                tasks = tasks;
                return;
            }
            if (todoistTask.is_completed) {
                return;
            }
            if (!todoistTask.due || todoistTask.due.date === utils.dateFormat() || isPast(parseISO(todoistTask.due.date))) {
                let dt = new Date();
                let diffDays = 6 - dt.getDay();
                if (diffDays <= 1) {
                    // if tomorrow or today is Saturday, then postpone task to the next Saturday
                    diffDays += 7;
                }
                dt = addDays(dt, diffDays);
                const dueDate = utils.dateFormat(dt);
                await todoistAPI.postpone(task.todoistTaskId, dueDate, todoistTask);
            }
        },

        moveUp(task: Task, index: number, size = 1) {
            if (index === 0) {
                return;
            }
            const newIndex = Math.max(0, index - size);
            tasks.splice(index, 1);
            tasks.splice(newIndex, 0, task);
            tasks = tasks;
        },

        moveDown(task: Task, index: number, size = 1) {
            if (index + 1 === tasks.length) {
                return;
            }
            const newIndex = Math.min(tasks.length - 1, index + size);
            tasks.splice(index, 1);
            tasks.splice(newIndex, 0, task);
            tasks = tasks;
        },

        moveTop(task: Task, index: number) {
            if (index === 0) {
                return;
            }
            let newIndex = 0;
            const now = new Date();
            if (lastMoveTopAt && now - lastMoveTopAt > 30 * 1000) {
                // if tasks were moved to the top fast enough they are placed one after each other, instead of in front
                lastMoveTopAt = null;
            }
            if (lastMoveTopAt) {
                newIndex = ++lastMoveTopIndex;
            } else {
                if (!tasks[index - 1].done) {
                    for (let i = index - 1; i >= 0; i--) {
                        if (tasks[i].done) {
                            newIndex = i + 1;
                            break;
                        }
                    }
                }
                lastMoveTopIndex = newIndex;
            }
            lastMoveTopAt = now;
            tasks.splice(index, 1);
            tasks.splice(newIndex, 0, task);
            tasks = tasks;
        },

        moveBottom(task: Task, index: number) {
            if (index + 1 === tasks.length) {
                return;
            }
            let newIndex = tasks.length;
            if (!tasks[index + 1].postponed) {
                for (let i = index + 1; i < tasks.length; i++) {
                    if (tasks[i].postponed) {
                        newIndex = i - 1;
                        break;
                    }
                }
            }
            tasks.splice(index, 1);
            tasks.splice(newIndex, 0, task);
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
            if (event.key === "Delete" && onlyAlt) {
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
                focusTask = this.add(index + 1);
            } else if (onlyCtrl && event.key === "Enter") {
            } else if (onlyAlt && event.key === "PageUp" && tasks.length) {
                focusTask = tasks.find((t: Task) => !t.done) || tasks[0];
            } else if (onlyAlt && event.key === "PageDown" && tasks.length) {
                focusTask = tasks[tasks.length - 1];
            } else if (onlyAlt && event.key === "Enter") {
                this.toggle(task, index).then();
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

        async inputBlur(task: Task, index: number, event: KeyboardEvent) {
            event.target.value = task.title = task.title.trim();
        },

        dragHandleDown(event) {
            event.target.closest(".task").setAttribute("draggable", "true");
        },

        dragHandleUp(event) {
            event.target.closest(".task").removeAttribute("draggable");
        },

        dragStart(event) {
            console.debug("start", event);
            const taskId = event.target.dataset.taskId;
            const task = findTask(taskId);
            event.dataTransfer.setDragImage(new Image(), 0, 0);
            event.dataTransfer.setData("application/my-app", taskId);
            event.dataTransfer.effectAllowed = "move";
            setTimeout(function () {
                // without this dragging even immediately ends
                draggingTaskId = taskId;
            });
        },

        dragDrop(event) {
            resetLastMoveTopMemory();
            if (event.target.dataset.index === undefined) {
                return;
            }
            let newIndex = parseInt(event.target.dataset.index);
            // console.debug("drop", event, newIndex);
            const dragTaskId = event.dataTransfer.getData("application/my-app");
            const oldIndex = tasks.findIndex((task: Task) => task.id === dragTaskId);
            const dragTask = tasks[oldIndex];
            if (oldIndex < newIndex) {
                --newIndex;
            }
            tasks.splice(oldIndex, 1);
            tasks.splice(newIndex, 0, dragTask);
            tasks = tasks;
        },

        dragOver(event) {
            // console.debug("over", event);
            if (!event.target.classList.contains("dropZone")) {
                return;
            }
            activeDropZoneIndex = parseInt(event.target.dataset.index);
        },

        dragEnd(event) {
            console.debug("end", event);
            event.target.closest(".task").removeAttribute("draggable");
            activeDropZoneIndex = null;
            draggingTaskId = null;
        },

        dragEnter(event) {
            console.debug("enter", event.target);
            if (!event.target.classList.contains("dropZone")) {
                return;
            }
            event.dataTransfer.dropEffect = "move";
            activeDropZoneIndex = parseInt(event.target.dataset.index);
        },

        dragLeave(event) {
            console.debug("leave", event.target);
            event.dataTransfer.dropEffect = "none";
            activeDropZoneIndex = null;
        },

        updated() {
            tasks = tasks;
        },
    };

    $: tasks && tasksUpdated();
</script>

<svelte:document on:keyup="{appKeyUp}"></svelte:document>
<svelte:window
        on:beforeunload="{saveIfDebounced}"
        on:blur="{saveIfDebounced}"
></svelte:window>

<div class="panel top">
    <div class="lineOne">
        <button on:click="{addTaskToTheEnd}" tabindex="-1">
            <Fa icon="{faAdd}"/>
        </button>
        <button on:click="{clearAllTasks}" tabindex="-1">
            <Fa icon="{faXmark}"/>
        </button>
        <button on:click="{clearDoneTasks}" tabindex="-1">
            <Fa icon="{faXmark}"/>
            <Fa icon="{faCircleCheck}"/>
        </button>
        <button on:click="{clearPostponedTasks}" tabindex="-1">
            <Fa icon="{faXmark}"/>
            <Fa icon="{faClock}"/>
        </button>
        <button on:click="{clearExternalTasks}" tabindex="-1">
            <Fa icon="{faXmark}"/>
            <Fa icon="{faNotEqual}"/>
            <Fa icon="{faAdd}"/>
        </button>
        {#if todoistAPI}
            <button disabled="{loading}" on:click="{fetchTodoistTasks}"
                    tabindex="-1"
            >
                <Fa icon="{faDownload}"/>
                Todoist
            </button>
        {/if}
    </div>
    <div class="lineTwo">
        <label>
            <input bind:checked="{showActiveTasksOnly}" type="checkbox">
            Show active only
        </label>
        <button disabled="{showActiveTasksOnly}"
                on:click="{() => tasksReorder()}"
                tabindex="-1"
        >
            <Fa icon="{faArrowDownAZ}"/>
            Sort
        </button>
    </div>
</div>
<div class="content">
    {#if tasks.length}
        <div class="current"
             class:draggingActive="{draggingTaskId !== null}"
        >
            <div class="dropZoneHolder">
                <div
                        class="dropZone"
                        class:isActive="{activeDropZoneIndex === 0}"
                        on:drop|preventDefault="{taskActions.dragDrop}"
                        on:dragover|preventDefault="{taskActions.dragOver}"
                        on:dragenter="{taskActions.dragEnter}"
                        on:dragleave="{taskActions.dragLeave}"
                        data-index="0"
                >
                    <hr/>
                </div>
            </div>
            {#each displayTasks as task, index (task.id)}
                <div
                        animate:flip="{{duration: 300}}"
                >
                    <CurrentTask
                            bind:refDuration="{taskDurationRefs[task.id]}"
                            bind:refTitle="{taskTitleRefs[task.id]}"
                            {task}
                            {index}
                            actions="{taskActions}"
                            isDragging="{draggingTaskId === task.id}"
                    />
                    <div class="dropZoneHolder">
                        <div
                                class="dropZone"
                                class:isActive="{activeDropZoneIndex === index + 1}"
                                on:drop|preventDefault="{taskActions.dragDrop}"
                                on:dragover|preventDefault="{taskActions.dragOver}"
                                on:dragenter="{taskActions.dragEnter}"
                                on:dragleave="{taskActions.dragLeave}"
                                data-index="{index + 1}"
                        >
                            <hr/>
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    {:else}
        <div class="empty">No tasks yet</div>
    {/if}
</div>
{#if false}
    <div class="panel bottom">
        <button disabled="{!canUndo}" on:click="{undo}" tabindex="-1">&laquo; undo</button>
        <button disabled="{!canRedo}" on:click="{redo}" tabindex="-1">redo &raquo;</button>
    </div>
{/if}

<style>
    .panel {
        text-align: center;
    }

    .panel button {
        padding: .2rem .3rem;
    }

    .panel .lineTwo {
        padding-top: 0.5rem;
    }

    .content {
        margin: 0.5rem 0;
    }

    .empty {
        font-size: large;
        padding: 1rem;
        text-align: center;
    }

    .current {
        width: 100%;
    }

    .dropZoneHolder {
        position: relative;
    }

    .dropZone {
        position: absolute;
        width: 100%;
    }

    .draggingActive .dropZone {
        padding: 0.9rem 0;
        z-index: 1000;
        top: -0.9rem;
    }

    .dropZone hr {
        border: none;
        border-top: 1px solid rgba(255, 255, 255, 1);
    }

    .dropZone.isActive hr {
        border-top: 1px solid gray;
    }

    .current :global(button) {
        background-color: transparent;
        border-style: none;
        color: var(--text-color);
        cursor: pointer;
    }

</style>
