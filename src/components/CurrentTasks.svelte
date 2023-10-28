<script lang="ts">
    import * as utils from "../lib/utils";
    import {dateHumanFormat} from "../lib/utils";
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
    import {faXmark} from "@fortawesome/free-solid-svg-icons/faXmark";
    import {flip} from "svelte/animate";
    import {md5} from "pure-md5";
    import {tick} from "svelte";
    import {faEraser} from "@fortawesome/free-solid-svg-icons/faEraser";
    import {faUpload} from "@fortawesome/free-solid-svg-icons/faUpload";
    import {faSearch} from "@fortawesome/free-solid-svg-icons/faSearch";
    import {faBroom} from "@fortawesome/free-solid-svg-icons/faBroom";
    import {faArrowDownAZ} from "@fortawesome/free-solid-svg-icons/faArrowDownAZ";
    import {faHeart} from "@fortawesome/free-regular-svg-icons/faHeart";
    import Modal from "./Modal.svelte";
    import TTFavorite from "../models/TTFavorite";
    import ShowTTFavorite from "./ShowTTFavorite.svelte";
    import {faSave} from "@fortawesome/free-regular-svg-icons/faSave";
    import {faEdit} from "@fortawesome/free-regular-svg-icons/faEdit";
    import EditTTFavorite from "./EditTTFavorite.svelte";
    import {loadEvents} from "../services/google";
    import {faCalendarDays} from "@fortawesome/free-regular-svg-icons/faCalendarDays";
    import {faGoogle} from "@fortawesome/free-brands-svg-icons/faGoogle";

    export let ignoreNextTasksUpdate: boolean = false;
    export let tasks: Array<Task> = [];
    export let saveTasks: (tasks: Array<Task>) => void = (tasks: Array<Task>) => null;
    export let timerURLs = {};
    export let saveTimerURL: (todoistTaskId, url) => void = (todoistTaskId, url) => null;
    export let togglTrackFavorites: Array<TTFavorite> = [];
    export let saveTogglTrackFavorites: () => void = () => null;

    let filterBy = localStorage.getItem("filterBy") || "all";
    const FILTERS = Object.freeze({
        ACTIVE: "active",
        DONE: "done",
        POSTPONED: "postponed",
        ALL: "all",
    });

    $: {
        localStorage.setItem("filterBy", filterBy);
        resetRecentlyChanged();
    }
    $: displayTasks = tasks.filter((task: Task) => {
        if (task.recentlyChanged) {
            return true;
        }
        if (searchPhrase) {
            return task.title.toLowerCase().includes(searchPhrase.toLowerCase());
        }
        switch (filterBy) {
            case FILTERS.ACTIVE:
                return !task.done && !task.postponed;
            case FILTERS.DONE:
                return task.done;
            case FILTERS.POSTPONED:
                return task.postponed;
            case FILTERS.ALL:
                return true;
        }
        throw new Error(`Unknown value filterBy=${filterBy}`);
    }).sort(function (taskA: Task, taskB: Task) {
        if (filterBy === FILTERS.DONE) {
            if (!taskA.done && taskB.done) {
                return 1;
            }
            if (taskA.done && !taskB.done) {
                return -1;
            }
            if (taskA.done && taskB.done) {
                return taskA.finishTime < taskB.finishTime ? -1 : 0;
            }
            return 0;
        } else if (filterBy === FILTERS.POSTPONED) {
            return taskA.title < taskB.title ? -1 : 0;
        }
    });
    $: tasks && tasksUpdated();

    function checkFilterDone() {
        if ([FILTERS.DONE, FILTERS.POSTPONED].includes(filterBy)) {
            alert("Can't reorder tasks while filtering by done");
            return true;
        }
        return false;
    }

    const taskTitleRefs: Map<string, HTMLInputElement> = new Map();
    const taskDurationRefs: Map<string, HTMLInputElement> = new Map();
    let lastActiveElement: HTMLInputElement | null;
    let lastTasksHash: string;
    let showDeletePanel = false;

    const todoistAccessToken = import.meta.env.MY_TODOIST_ACCESS_TOKEN || "";
    const todoistAPI: TodoistAPI | null = todoistAccessToken ? new TodoistAPI(todoistAccessToken) : null;
    let loading = false;
    let brooming = false;

    let saveTimeout;

    function debouncedSave() {
        if (saveTimeout) {
            clearTimeout(saveTimeout);
        }
        saveTimeout = setTimeout(() => {
            saveTasks(tasks);
        }, 2000);
    }

    function saveIfDebounced() {
        if (saveTimeout) {
            clearTimeout(saveTimeout);
            saveTimeout = null;
            saveTasks(tasks);
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
                    if (task.title) {
                        task.startTime = utils.timeFormat(now);
                    } else {
                        delete task.startTime;
                    }
                    delete task.finishTime;
                }
                continue;
            }
            task.startTime = utils.timeFormat(now);
            now = addMinutes(now, duration);
            task.finishTime = utils.timeFormat(now);
            now = addMinutes(now, gap);
        }
    }

    async function tasksReorder(index?: number) {
        resetLastMoveTopMemory();
        const focusedAt = document.activeElement;
        let refs;
        if (focusedAt.tagName === "INPUT" && index !== undefined) {
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
            if (taskA.done && taskB.done) {
                return taskA.finishTime < taskB.finishTime ? -1 : 0;
            }
            if (!taskA.postponed && taskB.postponed) {
                return -1;
            }
            if (taskA.postponed && !taskB.postponed) {
                return 1;
            }
            if (taskA.postponed && taskB.postponed) {
                return taskA.postponed < taskB.postponed ? -1 : 0;
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

    function findTask(taskId): Task | null {
        return tasks.find((task: Task) => task.id === taskId);
    }

    function findTaskIndex(taskId): number | null {
        return tasks.findIndex((task: Task) => task.id === taskId);
    }

    function findVisibleTaskIndex(taskId): number | null {
        return displayTasks.findIndex((task: Task) => task.id === taskId);
    }

    async function addTaskToTheEnd() {
        let index = 0;
        const lastFocusedIndex = lastFocusedTaskId && findVisibleTaskIndex(lastFocusedTaskId);
        if (lastFocusedIndex) {
            index = lastFocusedIndex;
        } else {
            for (let i = displayTasks.length - 1; i >= 0; --i) {
                if (!displayTasks[i].postponed) {
                    index = i;
                    break;
                }
            }
        }
        const task = taskActions.add(index + 1);
        await tick();
        taskTitleRefs[task.id].focus();
    }

    let showTogglTrackFavoritesModal = false;
    let editingTogglTrackFavorites = false;

    function showTogglTrackFavorites() {
        showTogglTrackFavoritesModal = true;
    }

    function toggleEditingTogglTrackFavorites() {
        editingTogglTrackFavorites = !editingTogglTrackFavorites;
    }

    function addTogglTrackFavorite() {
        let maxOrder = 0;
        for (const togglTrackFavorite: TTFavorite of togglTrackFavorites) {
            maxOrder = Math.max(maxOrder, togglTrackFavorite.order);
        }
        maxOrder += 10;
        togglTrackFavorites.push(new TTFavorite(maxOrder));
        togglTrackFavorites = togglTrackFavorites;
        editingTogglTrackFavorites = true;
    }

    function deleteTogglTrackFavorite(index) {
        togglTrackFavorites.splice(index, 1);
        togglTrackFavorites = togglTrackFavorites;
    }

    let showSearchInput = false;
    let searchPhrase = "";
    let searchInputRef: HTMLInputElement;

    async function toggleSearchPanel() {
        showSearchInput = !showSearchInput;
        if (showSearchInput) {
            resetRecentlyChanged();
            await tick();
            searchInputRef.focus();
        } else {
            searchPhrase = "";
        }
    }

    async function toggleShowDeletePanel() {
        showDeletePanel = !showDeletePanel;
    }

    function deleteAllTasks() {
        if (!confirm("Delete all tasks?")) {
            return;
        }
        tasks = [];
    }

    function deletePostponedTasks() {
        if (!confirm("Delete postponed tasks?")) {
            return;
        }
        const newTasks = tasks.filter((task: Task) => !task.postponed);
        if (newTasks.length !== tasks.length) {
            tasks = newTasks;
        }
    }

    function deleteDoneTasks() {
        if (!confirm("Delete done tasks?")) {
            return;
        }
        const newTasks = tasks.filter((task: Task) => !task.done);
        if (newTasks.length !== tasks.length) {
            tasks = newTasks;
        }
    }

    async function deleteCompletelyDoneTasks(silent) {
        if (!todoistAPI) {
            return;
        }
        if (!silent && !confirm("Delete completely (in Todoist) done tasks?")) {
            return;
        }
        const ids: string[] = tasks
            .filter((task: Task) => task.todoistTaskId && task.done)
            .map((task: Task) => task.todoistTaskId as string);
        if (!ids.length) {
            silent || alert("Nothing to check");
            return;
        }
        const todoistTasks: TodoistTask[] = await todoistAPI.getTasksByIds(ids, false);
        const completedTaskIds = todoistTasks
            .filter((todoistTask: TodoistTask) => todoistTask.is_completed)
            .map((todoistTask: TodoistTask) => todoistTask.id);
        const diff = ids.length - completedTaskIds.length;
        if (!diff) {
            silent || alert("Nothing to delete");
            return;
        }
        const newTasks = tasks.filter((task: Task) => task.todoistTaskId && !completedTaskIds.includes(task.todoistTaskId));
        if (newTasks.length !== tasks.length) {
            tasks = newTasks;
        }
        silent || alert(`${diff} tasks deleted`);
    }

    function deleteInternalDoneTasks(silent) {
        if (!silent && !confirm("Delete manually added done tasks?")) {
            return;
        }
        const newTasks = tasks.filter((task: Task) => task.todoistTaskId || !task.done);
        if (newTasks.length !== tasks.length) {
            tasks = newTasks;
        }
    }

    function deleteImportedTasks() {
        if (!confirm("Delete imported tasks?")) {
            return;
        }
        const newTasks = tasks.filter((task: Task) => !task.todoistTaskId);
        if (newTasks.length !== tasks.length) {
            tasks = newTasks;
        }
    }

    async function deleteNonExistingImportedTasks(silent) {
        if (!todoistAPI) {
            return;
        }
        if (!silent && !confirm("Delete imported not existing anymore tasks?")) {
            return;
        }
        const ids = tasks.map((task: Task) => task.todoistTaskId || "").filter(Boolean);
        if (!ids.length) {
            silent || alert("Nothing to check");
            return;
        }
        const todoistTasks = await todoistAPI.getTasksByIds(ids, false);
        const diff = ids.length - todoistTasks.length;
        if (!diff) {
            silent || alert("Nothing to delete");
            return;
        }
        const todoistTaskIds = todoistTasks.map((todoistTask: TodoistTask) => todoistTask.id);
        const newTasks = tasks.filter((task: Task) => task.todoistTaskId && todoistTaskIds.includes(task.todoistTaskId));
        if (newTasks.length !== tasks.length) {
            tasks = newTasks;
        }
        silent || alert(`${diff} tasks deleted`);
    }

    async function deleteGoogleEvents(silent) {
        if (!silent && !confirm("Delete all events from Google Calendar?")) {
            return;
        }
        const oldCount = tasks.length;
        const newTasks = tasks.filter((task: Task) => !task.eventId);
        const diff = oldCount - newTasks.length;
        if (!diff) {
            silent || alert("Nothing to delete");
            return;
        }
        tasks = newTasks;
        silent || alert(`${diff} events deleted`);
    }

    async function transferDoneToPostponed() {
        let changed = false;
        tasks.forEach((task: Task) => {
            if (task.todoistTaskId && task.done) {
                task.done = false;
                task.postponed = "?";
                delete task.finishTime;
                changed = true;
            }
        });
        if (changed) {
            tasks = tasks;
        }
    }

    async function broomTheDay() {
        if (!confirm("Are you sure you want to clean the list up for today?")) {
            return;
        }
        brooming = true;
        resetRecentlyChanged();
        try {
            await deleteInternalDoneTasks(true);
            await deleteCompletelyDoneTasks(true);
            await deleteNonExistingImportedTasks(true);
            await deleteGoogleEvents(true);
            await transferDoneToPostponed();
            await fetchTodoistTasks(false);
            await loadGoogleCalendarEvents(false);
        } finally {
            brooming = false;
        }
    }

    async function fetchTodoistTasks(updateRecentlyChanged = true) {
        if (!todoistAPI) {
            return;
        }
        resetRecentlyChanged();
        loading = true;
        let todoistTasks;
        try {
            todoistTasks = await todoistAPI.getTasks();
            if (todoistTasks.length) {
                const firstWithDuration = todoistTasks.find((todoistTask: TodoistTask) => todoistTask.duration);
                if (firstWithDuration) {
                    console.error("Seems like Todoist has fixed the bug! 🍾🍾🍾");
                } else {
                    // probably, there should be tasks with duration set, so to check that, let's request tasks by ids
                    // it works correctly in Todoist in this case
                    const ids = todoistTasks.map((todoistTask: TodoistTask) => todoistTask.id);
                    todoistTasks = await todoistAPI.getTasksByIds(ids);
                }
            }
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
        const tasksToAdd = todoistTasks.map((todoistTask: TodoistTask) => {
            let title = todoistTask.content;
            const todoistTaskId = todoistTask.id;
            const todoistPriority = todoistTask.priority;
            if (
                title.startsWith("*") ||
                title.endsWith("~") ||
                todoistTask.labels.indexOf("noplan") !== -1
            ) {
                return;
            }
            taskIds.push(todoistTaskId);
            let duration;
            if (todoistTask.duration) {
                duration = todoistTask.duration.amount;
            }
            const hasDuration = title.match(searchDuration);
            if (hasDuration) {
                title = title.slice(0, title.length - hasDuration[0].length);
                if (!duration) {
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
                const durationHasChanged = existingTask.duration === undefined && duration;
                if (
                    existingTask.done
                    || existingTask.postponed
                    || existingTask.title !== title
                    || durationHasChanged
                    || existingTask.todoistPriority !== todoistPriority
                ) {
                    existingTask.done = false;
                    existingTask.postponed = null;
                    existingTask.title = title;
                    if (durationHasChanged) {
                        existingTask.duration = duration;
                    }
                    existingTask.todoistPriority = todoistPriority;
                    if (updateRecentlyChanged) {
                        existingTask.recentlyChanged = true;
                    }
                    taskUpdated = true;
                }
                return;
            }
            const task = new Task({title, duration, todoistTaskId, todoistPriority});
            if (updateRecentlyChanged) {
                task.recentlyChanged = true;
            }
            return task;
        }).filter(Boolean);
        for (let i = 0; i < tasks.length; ++i) {
            let task = tasks[i];
            if (!task.todoistTaskId) {
                continue;
            }
            if (!task.postponed && !task.done && !taskIds.includes(task.todoistTaskId)) {
                task.postponed = "?";
                if (updateRecentlyChanged) {
                    task.recentlyChanged = true;
                }
                taskUpdated = true;
            }
        }
        if (tasksToAdd.length) {
            tasks.splice(tasks.length, 0, ...tasksToAdd);
        } else if (taskUpdated) {
            alert("No new tasks, but something has changed");
        } else {
            alert("Nothing has changed");
        }
        if (tasksToAdd.length || taskUpdated) {
            tasks = tasks;
            if (updateRecentlyChanged) {
                setRecentlyChangedTimeout();
            }
        }
        const retrievePostponeDateTodoistTaskIds = tasks.filter(t => t.postponed === "?").map(t => t.todoistTaskId);
        await retrievePostponeDates(retrievePostponeDateTodoistTaskIds);
    }

    async function retrievePostponeDates(todoistTaskIds) {
        if (!todoistTaskIds.length) {
            return;
        }
        if (!todoistAPI) {
            return;
        }
        const todoistTasks = await todoistAPI.getTasksByIds(todoistTaskIds, false);
        const todoistTasksPairs: Array<[string, TodoistTask]> = todoistTasks.map((todoistTask: TodoistTask) => [todoistTask.id, todoistTask]);
        const todoistTasksMap = Object.fromEntries(todoistTasksPairs);
        let changed = false;
        let index = tasks.length - 1;
        while (index >= 0) {
            const task: Task = tasks[index];
            index -= 1;
            if (!task.todoistTaskId || !todoistTaskIds.includes(task.todoistTaskId)) {
                continue;
            }
            const todoistTask: TodoistTask = todoistTasksMap[task.todoistTaskId];
            if (!todoistTask) {
                // task was deleted in Todoist
                tasks.splice(index + 1, 1); // we use reversed while because of this deletion
            } else if (todoistTask.is_completed) {
                task.done = true;
                task.postponed = null;
            } else if (!todoistTask.is_completed) {
                if (todoistTask.due) {
                    task.postponed = dateHumanFormat(parseISO(todoistTask.due.date));
                } else {
                    task.postponed = "N/A";
                }
            } else {
                continue;
            }
            changed = true;
        }
        if (changed) {
            tasks = tasks;
        }
    }

    async function uploadTodoistTasks() {
        if (!todoistAPI) {
            return;
        }
        loading = true;
        try {
            let todoistTasks;
            const ids = tasks.map(
                (task: Task) => !task.done && !task.postponed && task.todoistTaskId || "",
            ).filter(Boolean);
            if (!ids.length) {
                alert("Nothing to save");
                return;
            }
            try {
                todoistTasks = await todoistAPI.getTasksByIds(ids, false);
            } catch (e) {
                console.error(e);
                alert("Error fetching tasks from Todoist");
                return;
            }
            if (!todoistTasks.length) {
                alert("Tasks were not found on Todoist");
                return;
            }
            const today = utils.dateFormat();
            try {
                for (const todoistTask of todoistTasks) {
                    const taskId = todoistTask.id;
                    const task = displayTasks.find((t) => t.todoistTaskId === taskId);
                    const payload = {};
                    if (todoistTask.due.is_recurring) {
                        payload["due_string"] = todoistTask.due.string;
                    }
                    payload["due_datetime"] = `${today}T${task.startTime}:00`;
                    if (task.duration) {
                        payload["duration"] = task.duration;
                        payload["duration_unit"] = "minute";
                    }
                    await todoistAPI.update(taskId, payload);
                }
            } catch (e) {
                console.error(e);
                alert("Error updating tasks in Todoist");
                return;
            }
            alert("Saved");
        } finally {
            loading = false;
        }
    }

    let loadingEvents = false;

    async function loadGoogleCalendarEvents(updateRecentlyChanged = true) {
        loadingEvents = true;
        const events: gapi.client.calendar.Event[] = await loadEvents();
        loadingEvents = false;
        if (!events.length) {
            updateRecentlyChanged && alert("No events found");
            return;
        }
        const newTasks = tasks.filter((task: Task) => !task.eventId);
        for (const event of events) {
            const task = new Task();
            task.setGoogleEvent(event);
            if (updateRecentlyChanged) {
                task.recentlyChanged = true;
            }
            insertTaskByStartTime(task, newTasks);
        }
        tasks = newTasks;
        if (updateRecentlyChanged) {
            setRecentlyChangedTimeout();
        }
    }

    function insertTaskByStartTime(addTask: Task, tasks: Task[]) {
        recalculateTimes();
        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            if (task.finishTime && task.finishTime > addTask.eventStartTime) {
                tasks.splice(tasks.indexOf(task), 0, addTask);
                return;
            }
        }
        tasks.push(addTask);
    }

    function recalculateNumbers() {
        let number = 0;
        for (const t of tasks) {
            if (t.done || t.postponed || !t.duration && !t.title) {
                delete t.number;
            } else {
                t.number = ++number;
            }
        }
    }

    function appKeyUp(event: KeyboardEvent) {
        console.debug("appKeyUp", event);
        const activeElement: HTMLInputElement = document.activeElement as HTMLInputElement;
        if (!event.ctrlKey && !event.shiftKey && !event.altKey && event.key === "Enter") {
            addTaskToTheEnd();
        } else if (!event.ctrlKey && !event.shiftKey && !event.altKey && event.code === "Escape") {
            if (!lastActiveElement && displayTasks.length) {
                const firstTask = displayTasks.find((t: Task) => !t.done) || displayTasks[0];
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
        if (!todoistAPI) {
            return;
        }
        let title = task.title;
        if (task.duration) {
            title += ` ${task.duration}m`;
        }
        const todoistTask = await todoistAPI.create(title, dueDate);
        task.todoistTaskId = todoistTask.id;
        task.todoistPriority = todoistTask.priority;
        tasks = tasks;
    }

    let lastMoveTopAt: Date | null = null;
    let lastMoveTopIndex: number | null = null;
    let lastFocusedTaskId;

    function resetLastMoveTopMemory() {
        lastMoveTopAt = lastMoveTopIndex = null;
    }

    let resetRecentlyChangedTimeout;

    function resetRecentlyChanged() {
        resetLastMoveTopMemory();
        if (resetRecentlyChangedTimeout) {
            clearTimeout(resetRecentlyChangedTimeout);
            resetRecentlyChangedTimeout = null;
        }
        let changed = false;
        tasks.forEach((task: Task) => {
            if (task.recentlyChanged) {
                task.recentlyChanged = false;
                changed = true;
            }
        });
        if (changed) {
            tasks = tasks;
        }
    }

    function setRecentlyChangedTimeout() {
        if (resetRecentlyChangedTimeout) {
            clearTimeout(resetRecentlyChangedTimeout);
        }
        resetRecentlyChangedTimeout = setTimeout(resetRecentlyChanged, 5 * 60 * 1000);
    }

    let activeDropZoneIndex: number | null = null;
    let draggingTaskId: string | null = null;

    const taskActions = {
        async toggle(task: Task) {
            setRecentlyChangedTimeout();
            task.done = !task.done;
            task.recentlyChanged = true;
            const index = findTaskIndex(task.id) as number;
            if (task.done) {
                if (!task.duration && !task.title) {
                    // delete empty task
                    tasks.splice(index, 1);
                    tasks = tasks;
                    return;
                }
                delete task.startTime;
                task.finishTime = utils.timeFormat();
                task.postponed = null;
                tasks = tasks;
                if (!task.todoistTaskId || !todoistAPI) {
                    return;
                }
                const todoistTask = await todoistAPI.getTask(task.todoistTaskId);
                if (!todoistTask) {
                    task.resetTodoist();
                    tasks = tasks;
                    return;
                }
                if (todoistTask.is_completed) {
                    return;
                }
                const today = utils.dateFormat();
                const isDue = todoistTask.due && (todoistTask.due.date === today || isPast(parseISO(todoistTask.due.date)));
                if (isDue) {
                    await todoistAPI.complete(task.todoistTaskId);
                }
            } else {
                tasks = tasks;
                if (!task.todoistTaskId || !todoistAPI) {
                    return;
                }
                const todoistTask = await todoistAPI.getTask(task.todoistTaskId);
                if (!todoistTask) {
                    task.resetTodoist();
                    tasks = tasks;
                    return;
                }
                if (todoistTask.is_completed) {
                    await todoistAPI.reopen(task.todoistTaskId);
                } else {
                    const today = utils.dateFormat();
                    await todoistAPI.postpone(task.todoistTaskId, today, todoistTask);
                }
            }
        },

        delete(task: Task) {
            const index = findTaskIndex(task.id) as number;
            tasks.splice(index, 1);
            tasks = tasks;
        },

        async restore(task: Task) {
            if (!todoistAPI) {
                return;
            }
            setRecentlyChangedTimeout();
            task.postponed = null;
            task.recentlyChanged = true;
            tasks = tasks;
            const todoistTaskId = task.todoistTaskId as string;
            const todoistTask = await todoistAPI.getTask(todoistTaskId);
            if (!todoistTask) {
                task.resetTodoist();
                tasks = tasks;
                return;
            }
            if (todoistTask.is_completed) {
                await todoistAPI.reopen(todoistTaskId);
            }
            const dueDate = utils.dateFormat();
            await todoistAPI.postpone(todoistTaskId, dueDate, todoistTask);
        },

        create(task: Task) {
            const dueDate = utils.dateFormat();
            createTodoistTask(task, dueDate);
            tasks = tasks;
        },

        startTimer(task: Task) {
            let url = timerURLs[task.todoistTaskId];
            if (!url) {
                url = prompt("Provide URL:");
                if (url) {
                    saveTimerURL(task.todoistTaskId, url);
                }
                return;
            }
            window.open(url);
        },

        forgetTimer(task: Task) {
            saveTimerURL(task.todoistTaskId, null);
        },

        async postpone(task: Task, dt: Date) {
            if (!todoistAPI) {
                return;
            }
            setRecentlyChangedTimeout();
            const dueDate = utils.dateFormat(dt);
            task.postponed = dateHumanFormat(dt);
            task.recentlyChanged = true;
            tasks = tasks;
            const focusedAt = document.activeElement as HTMLInputElement;
            if (focusedAt && focusedAt.tagName === "INPUT") {
                focusedAt.blur();
            }
            const todoistTaskId = task.todoistTaskId as string;
            const todoistTask = await todoistAPI.getTask(todoistTaskId);
            if (!todoistTask) {
                task.resetTodoist();
                tasks = tasks;
                return;
            }
            if (todoistTask.is_completed) {
                return;
            }
            if (!todoistTask.due || todoistTask.due.date === utils.dateFormat() || isPast(parseISO(todoistTask.due.date))) {
                await todoistAPI.postpone(todoistTaskId, dueDate, todoistTask);
            }
        },

        async postponeTomorrow(task: Task) {
            const dt = addDays(new Date(), 1);
            await taskActions.postpone(task, dt);
        },

        async postponeSaturday(task: Task) {
            let dt = new Date();
            let diffDays = 6 - dt.getDay();
            if (diffDays <= 1) {
                // if tomorrow or today is Saturday, then postpone task to the next Saturday
                diffDays += 7;
            }
            dt = addDays(dt, diffDays);
            await taskActions.postpone(task, dt);
        },

        async postponeSunday(task: Task) {
            let dt = new Date();
            let diffDays = 7 - dt.getDay();
            if (diffDays <= 1) {
                // if tomorrow or today is Sunday, then postpone task to the next Saturday
                diffDays += 7;
            }
            dt = addDays(dt, diffDays);
            await taskActions.postpone(task, dt);
        },

        moveUp(task: Task, size = 1) {
            if (checkFilterDone()) {
                return;
            }
            const displayIndex = findVisibleTaskIndex(task.id);
            if (displayIndex === 0) {
                return;
            }
            const newDisplayIndex = Math.max(0, displayIndex - size);
            const index = findTaskIndex(task.id) as number;
            const newIndex = findTaskIndex(displayTasks[newDisplayIndex].id) as number;
            tasks.splice(index, 1);
            tasks.splice(newIndex, 0, task);
            tasks = tasks;
        },

        moveDown(task: Task, size = 1) {
            if (checkFilterDone()) {
                return;
            }
            const displayIndex = findVisibleTaskIndex(task.id);
            if (displayIndex + 1 === displayTasks.length) {
                return;
            }
            const newDisplayIndex = Math.min(displayTasks.length - 1, displayIndex + size);
            const index = findTaskIndex(task.id) as number;
            const newIndex = findTaskIndex(displayTasks[newDisplayIndex].id) as number;
            tasks.splice(index, 1);
            tasks.splice(newIndex, 0, task);
            tasks = tasks;
        },

        moveAfterFocused(task: Task) {
            if (checkFilterDone()) {
                return;
            }
            if (!lastFocusedTaskId) {
                alert("Focus in any task first");
                return;
            }
            const index = findTaskIndex(task.id) as number;
            const newIndex = findTaskIndex(lastFocusedTaskId) + 1;
            tasks.splice(index, 1);
            tasks.splice(newIndex, 0, task);
            tasks = tasks;
            lastFocusedTaskId = task.id;
        },

        moveTop(task: Task) {
            if (checkFilterDone()) {
                return;
            }
            const displayIndex = findVisibleTaskIndex(task.id);
            if (displayIndex === 0) {
                return;
            }
            let newDisplayIndex = 0;
            const now = new Date();
            if (lastMoveTopAt && now - lastMoveTopAt > 30 * 1000) {
                // if tasks were moved to the top fast enough they are placed one after each other, instead of in front
                lastMoveTopAt = null;
            }
            if (lastMoveTopAt) {
                newDisplayIndex = ++lastMoveTopIndex;
                if (newDisplayIndex + 1 === displayTasks.length) {
                    lastMoveTopIndex = newDisplayIndex = 0;
                }
            } else {
                lastMoveTopIndex = newDisplayIndex;
            }
            lastMoveTopAt = now;
            const index = findTaskIndex(displayTasks[displayIndex].id) as number;
            const newIndex = findTaskIndex(displayTasks[newDisplayIndex].id) as number;
            tasks.splice(index, 1);
            tasks.splice(newIndex, 0, task);
            tasks = tasks;
        },

        moveBottom(task: Task) {
            if (checkFilterDone()) {
                return;
            }
            const displayIndex = findVisibleTaskIndex(task.id);
            if (displayIndex + 1 === tasks.length) {
                return;
            }
            let newDisplayIndex = displayTasks.length - 1;
            const index = findTaskIndex(displayTasks[displayIndex].id) as number;
            const newIndex = findTaskIndex(displayTasks[newDisplayIndex].id) as number;
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

        async paste(task: Task, event: ClipboardEvent) {
            let index = findTaskIndex(task.id) as number;
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
                        return new Task({title, duration});
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

        async inputKeyDown(task: Task, event: KeyboardEvent, ref: HTMLInputElement) {
            // keydown event, so we can prevent default of (de)incrementing input type=number
            console.debug("inputKeyDown", event);
            const index = findVisibleTaskIndex(task.id);
            const onlyAlt = event.altKey && !event.shiftKey && !event.ctrlKey;
            const onlyCtrl = !event.altKey && !event.shiftKey && event.ctrlKey;
            const onlyShift = !event.altKey && event.shiftKey && !event.ctrlKey;
            const noSpecial = !event.altKey && !event.shiftKey && !event.ctrlKey;
            const inputType = ref.classList.contains("titleInput") ? "title" : "duration";
            let focusOn;
            let focusTask: Task | null;
            if (["ArrowUp", "ArrowDown", "PageUp", "PageDown"].includes(event.key)) {
                event.preventDefault();
            }
            const jumpSize = 5;
            if (noSpecial && event.key === "ArrowUp" && index) {
                focusTask = displayTasks[index - 1];
            } else if (noSpecial && event.key === "ArrowDown" && index + 1 < displayTasks.length) {
                focusTask = displayTasks[index + 1];
            } else if (noSpecial && event.key === "PageUp") {
                focusTask = displayTasks[Math.max(0, index - jumpSize)];
            } else if (noSpecial && event.key === "PageDown") {
                focusTask = displayTasks[Math.min(displayTasks.length - 1, index + jumpSize)];
            } else if (onlyShift && event.key === "ArrowUp") {
                this.moveUp(task);
            } else if (onlyShift && event.key === "ArrowDown") {
                this.moveDown(task);
            } else if (onlyShift && event.key === "PageUp") {
                this.moveUp(task, jumpSize);
            } else if (onlyShift && event.key === "PageDown") {
                this.moveDown(task, jumpSize);
            } else if (onlyAlt && event.key === "ArrowUp") {
                this.moveTop(task);
            } else if (onlyAlt && event.key === "ArrowDown") {
                this.moveBottom(task);
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
                if (focusOn.style.display === "none") {
                    focusOn.style.display = "";
                }
                focusOn.focus();
            }
        },

        async inputKeyUp(task: Task, event: KeyboardEvent, ref: HTMLInputElement) {
            console.debug("inputKeyUp", event);
            let index = findVisibleTaskIndex(task.id);
            const onlyAlt = event.altKey && !event.shiftKey && !event.ctrlKey;
            const onlyCtrl = !event.altKey && !event.shiftKey && event.ctrlKey;
            const onlyShift = !event.altKey && event.shiftKey && !event.ctrlKey;
            const noSpecial = !event.altKey && !event.shiftKey && !event.ctrlKey;
            const inputType = ref.classList.contains("titleInput") ? "title" : "duration";
            let focusOn;
            let focusTask: Task | null;
            if (event.key === "Delete" && onlyAlt) {
                if (index + 1 === displayTasks.length) {
                    --index;
                } else {
                    ++index;
                }
                focusTask = displayTasks[index];
                this.delete(task);
            } else if (noSpecial && event.key === "ArrowLeft" && inputType === "title" && !task.title) {
                focusOn = taskDurationRefs[task.id];
            } else if (noSpecial && event.key === "ArrowRight" && inputType === "duration" && !task.duration) {
                focusOn = taskTitleRefs[task.id];
            } else if (noSpecial && event.key === "Enter") {
                focusTask = this.add(findTaskIndex(task.id) + 1);
            } else if (onlyCtrl && event.key === "Enter") {
            } else if (onlyAlt && event.key === "PageUp" && displayTasks.length) {
                focusTask = displayTasks.find((t: Task) => !t.done) || displayTasks[0];
            } else if (onlyAlt && event.key === "PageDown" && displayTasks.length) {
                focusTask = displayTasks[displayTasks.length - 1];
            } else if (onlyAlt && event.key === "Enter") {
                this.toggle(task).then();
            } else if (onlyShift && event.key === "Enter") {
                const nextIndex = findTaskIndex(task.id) as number;
                focusTask = this.add(nextIndex);
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
                if (focusOn.style.display === "none") {
                    focusOn.style.display = "";
                }
                focusOn.focus();
            }
        },

        titleInputBlur(task: Task, event: KeyboardEvent) {
            (event.target as HTMLInputElement).value = task.title = task.title.trim();
        },

        inputFocus(task: Task, event: KeyboardEvent) {
            lastFocusedTaskId = task.id;
        },

        dragHandleDown(event) {
            event.target.closest(".task").setAttribute("draggable", "true");
        },

        dragHandleUp(event) {
            event.target.closest(".task").removeAttribute("draggable");
        },

        dragStart(event) {
            console.debug("start", event);
            if (checkFilterDone()) {
                event.preventDefault();
                return;
            }
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
            // console.debug("drop", event);
            if (event.target.dataset.index === undefined) {
                return;
            }
            let newIndex = parseInt(event.target.dataset.index);
            const dragTaskId = event.dataTransfer.getData("application/my-app");
            const oldIndex = findTaskIndex(dragTaskId) as number;
            const dragTask = tasks[oldIndex];
            const oldVisibleIndex = findVisibleTaskIndex(dragTaskId);
            if (oldVisibleIndex <= newIndex - 1) {
                --newIndex;
            }
            newIndex = findTaskIndex(displayTasks[newIndex].id) as number;
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

</script>

<svelte:document on:keyup="{appKeyUp}"></svelte:document>
<svelte:window
        on:beforeunload="{saveIfDebounced}"
        on:blur="{saveIfDebounced}"
></svelte:window>

<div class="panel top">
    <div class="main">
        <button
                disabled="{brooming}"
                on:click="{() => showTogglTrackFavorites()}"
                tabindex="-1"
        >
            <Fa icon="{faHeart}"/>
        </button>
        <button
                disabled="{brooming}"
                on:click="{() => addTaskToTheEnd()}"
                tabindex="-1"
        >
            <Fa icon="{faAdd}"/>
        </button>
        <button
                disabled="{brooming}"
                on:click="{() => toggleShowDeletePanel()}"
                tabindex="-1"
        >
            <Fa icon="{faXmark}"/>
        </button>
        <button
                disabled="{!resetRecentlyChangedTimeout}"
                on:click="{() => resetRecentlyChanged()}"
                tabindex="-1"
        >
            <Fa icon="{faEraser}"/>
        </button>
        <button
                disabled="{loading || brooming}"
                on:click="{() => broomTheDay()}"
                tabindex="-1"
        >
            <Fa icon="{faBroom}"/>
        </button>
        {#if todoistAPI}
            <button
                    disabled="{loading || brooming}"
                    tabindex="-1"
                    on:click="{() => fetchTodoistTasks()}"
            >
                <Fa icon="{faDownload}"/>
            </button>
            {#if todoistAPI}
                <button
                        disabled="{loading || brooming}"
                        tabindex="-1"
                        on:click="{uploadTodoistTasks}"
                >
                    <Fa icon="{faUpload}"/>
                </button>
            {/if}
        {/if}
        <button
                disabled="{loadingEvents}"
                on:click="{() => loadGoogleCalendarEvents()}"
                tabindex="-1"
        >
            <Fa icon="{faGoogle}"/>
            <Fa icon="{faCalendarDays}"/>
        </button>
    </div>
    {#if showDeletePanel && !brooming}
        <div class="delete">
            Delete:
            <button
                    tabindex="-1"
                    on:click="{() => deleteAllTasks()}">
                all
            </button>
            <button
                    on:click="{() => deleteDoneTasks()}"
                    tabindex="-1"
            >
                <Fa icon="{faCircleCheck}"/>
            </button>
            <button
                    tabindex="-1"
                    on:click="{() => deletePostponedTasks()}"
            >
                <Fa icon="{faClock}"/>
            </button>
            {#if todoistAPI}
                <button
                        tabindex="-1"
                        on:click="{() => deleteCompletelyDoneTasks()}"
                >
                    completely
                    <Fa icon="{faCircleCheck}"/>
                </button>
            {/if}
            <button
                    tabindex="-1"
                    on:click="{() => deleteInternalDoneTasks()}"
            >
                internal
                <Fa icon="{faCircleCheck}"/>
            </button>
            <button
                    tabindex="-1"
                    on:click="{() => deleteImportedTasks()}"
            >
                imported
            </button>
            {#if todoistAPI}
                <button
                        tabindex="-1"
                        on:click="{() => deleteNonExistingImportedTasks()}"
                >
                    imported deleted
                </button>
            {/if}
            <button
                    tabindex="-1"
                    on:click="{() => deleteGoogleEvents()}"
            >
                events
            </button>
        </div>
    {/if}
    <div>
        <button
                id="searchBtn"
                on:click="{toggleSearchPanel}"
                tabindex="-1"
        >
            {#if showSearchInput}
                <Fa icon="{faXmark}" fw/>
            {:else}
                <Fa icon="{faSearch}" fw/>
            {/if}
        </button>
        {#if showSearchInput}
            <input type="text" id="searchInput"
                   bind:value="{searchPhrase}"
                   bind:this="{searchInputRef}"
            />
        {:else}
            <span id="filterPane">
                <label><input bind:group="{filterBy}" name="filterBy" type="radio" value="{FILTERS.ALL}"/> all</label>
                <label><input bind:group="{filterBy}" name="filterBy" type="radio"
                              value="{FILTERS.ACTIVE}"/> active</label>
                <label><input bind:group="{filterBy}" name="filterBy" type="radio" value="{FILTERS.DONE}"/>
                    <Fa icon="{faCircleCheck}"/>
                </label>
                <label><input bind:group="{filterBy}" name="filterBy" type="radio" value="{FILTERS.POSTPONED}"/>
                    <Fa icon="{faClock}"/>
                </label>
            </span>
        {/if}
        {#if false}
            <button
                    tabindex="-1"
                    disabled="{filterBy !== 'all'}"
                    on:click="{() => tasksReorder()}"
            >
                <Fa icon="{faArrowDownAZ}"/>
                Sort
            </button>
        {/if}
    </div>
</div>
<div class="content">
    {#if displayTasks.length}
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
                            actions="{taskActions}"
                            bind:refDuration="{taskDurationRefs[task.id]}"
                            bind:refTitle="{taskTitleRefs[task.id]}"
                            isDragging="{draggingTaskId === task.id}"
                            hasTimer="{timerURLs[task.todoistTaskId]}"
                            todoistAPIAvailable="{!!todoistAPI}"
                            {index}
                            {task}
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
    {:else if tasks.length && searchPhrase}
        <div class="empty">No tasks including search phrase</div>
    {:else if tasks.length}
        <div class="empty">No tasks for current filter</div>
    {:else}
        <div class="empty">No tasks yet</div>
    {/if}
</div>

<Modal bind:showModal="{showTogglTrackFavoritesModal}">
    <h2 slot="header">
        Favorite Toggl Track timers
    </h2>

    <div class="togglTrackFavorites"
         class:columns="{!editingTogglTrackFavorites}">
        {#each togglTrackFavorites as tTFavorite, index (tTFavorite.id)}
            <svelte:component
                    this={editingTogglTrackFavorites ? EditTTFavorite : ShowTTFavorite}
                    {index}
                    bind:item="{tTFavorite}"
                    deleteItem="{() => deleteTogglTrackFavorite(index)}"
            />
        {/each}
    </div>
    <div class="togglTrackFavoritesActions">
        <button
                on:click="{addTogglTrackFavorite}"
        >
            <Fa icon="{faAdd}"/>
            Add
        </button>
        {#if editingTogglTrackFavorites}
            <button
                    on:click="{() => {
                        toggleEditingTogglTrackFavorites();
                        saveTogglTrackFavorites();
                    }}"
            >
                <Fa icon="{faSave}"/>
                Save
            </button>
        {:else}
            <button
                    on:click="{toggleEditingTogglTrackFavorites}"
            >
                <Fa icon="{faEdit}"/>
                Edit
            </button>
        {/if}
    </div>
</Modal>

<style>
    .panel {
        text-align: center;
    }

    .panel button {
        padding: .2rem .3rem;
    }

    .panel .main button {
        padding: .5rem .5rem;
        min-width: 2.5rem;
    }

    .panel .delete button {
        margin-bottom: .3rem;
    }

    .panel > div:not(:first-child) {
        padding-top: 0.5rem;
    }

    #searchInput {
        width: 13.5rem;
    }

    #searchBtn {
        border-style: none;
        background-color: transparent;
    }

    #filterPane {
        width: 14rem;
        display: inline-block;
    }

    #filterPane label {
        vertical-align: middle;
    }

    #filterPane label :global(svg) {
        vertical-align: initial !important;
    }

    .content {
        margin: 0.5rem 0;
    }

    .empty {
        font-size: large;
        padding: 1rem;
        text-align: center;
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
        border-top: 1px solid #808080;
    }

    .togglTrackFavorites {
        max-height: 80vmin;
        overflow-y: auto;
    }

    .togglTrackFavorites.columns {
        column-count: 2;
    }

    .togglTrackFavoritesActions {
        text-align: center;
    }

    .togglTrackFavoritesActions button {
        padding: 0.5rem 1rem;
        margin: 0.5rem auto 0 auto;
    }
</style>
