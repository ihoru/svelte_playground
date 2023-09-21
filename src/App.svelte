<script lang="ts">
    import CurrentTasks from "./components/CurrentTasks.svelte";
    import Task from "./models/task";
    import "reflect-metadata";
    import {plainToInstance} from "class-transformer";
    import * as storage from "./lib/storage";

    let currentTasks: Array<Task> = [];
    let currentTasksTimestamp: number = 0;
    let ignoreNextCurrentTasksUpdate: boolean = false;
    let lastUpdateTimestamp: number = 0;
    let storageError: string = null;

    function loadLocalCurrentTasks() {
        // console.log("local: load");
        currentTasksTimestamp = parseInt(localStorage.getItem("timestamp")) || 0;
        let data = localStorage.getItem("tasks") || "[]";
        try {
            data = JSON.parse(data);
        } catch (e) {
        }
        ignoreNextCurrentTasksUpdate = true;
        currentTasks = plainToInstance<Task, Array<object>>(Task, data);
    }

    function saveLocalCurrentTasks(tasks: Array<Task>, timestamp: number) {
        // console.log("local: save");
        localStorage.setItem("tasks", JSON.stringify(tasks));
        localStorage.setItem("timestamp", timestamp);
    }

    async function loadServerCurrentTasks() {
        console.debug("server: load");
        storageError = null;
        let json;
        try {
            json = await storage.get("tasks", currentTasksTimestamp);
        } catch (e) {
            storageError = e.toString();
            console.error(e);
            return;
        }
        console.debug("server: loaded");
        if (json) {
            applyCurrentTasksFromServer(json);
        }
    }

    async function saveServerCurrentTasks(tasks: string, timestamp: number, oldTimestamp: number) {
        console.debug("server: save");
        storageError = null;
        let json;
        try {
            json = await storage.set("tasks", timestamp, oldTimestamp, tasks);
        } catch (e) {
            storageError = e.toString();
            console.error(e);
            return;
        }
        if (json.ok) {
            currentTasksTimestamp = timestamp;
            lastUpdateTimestamp = (new Date()).getTime();
        } else {
            applyCurrentTasksFromServer(json);
            alert("Server has newer data");
        }
        console.debug("server: saved");
    }

    function applyCurrentTasksFromServer(json: object) {
        ignoreNextCurrentTasksUpdate = true;
        currentTasksTimestamp = parseInt(json.timestamp) || 0;
        lastUpdateTimestamp = (new Date()).getTime();
        currentTasks = plainToInstance<Task, Array<object>>(Task, json.data);
        saveLocalCurrentTasks(currentTasks, currentTasksTimestamp);
    }

    function saveCurrentTasks(tasks: Array<Task>) {
        console.info("! saveCurrentTasks");
        const timestamp = (new Date()).getTime();
        tasks = JSON.parse(JSON.stringify(tasks));
        tasks.forEach((task: Task) => {
            task.recentlyChanged = false;
        });
        saveLocalCurrentTasks(tasks, timestamp);
        saveServerCurrentTasks(tasks, timestamp, currentTasksTimestamp);
    }

    loadLocalCurrentTasks();
    loadServerCurrentTasks();

    function onWindowFocus() {
        console.debug("window: focus");
        const timestamp = (new Date()).getTime();
        if (timestamp - lastUpdateTimestamp > 1000 * 60 * 5) {
            lastUpdateTimestamp = (new Date()).getTime();
            loadServerCurrentTasks();
        }
    }

</script>

<svelte:window
        on:focus="{onWindowFocus}"
></svelte:window>

<main>
    {#if storageError}
        <div class="error">
            Storage API returned an error:
            <b>{storageError}</b>
        </div>
    {/if}
    <CurrentTasks
            bind:ignoreNextTasksUpdate="{ignoreNextCurrentTasksUpdate}"
            save="{saveCurrentTasks}"
            tasks="{currentTasks}"
    ></CurrentTasks>
</main>

<style>
    .error {
        text-align: center;
        margin: 0.5rem 0;
    }
</style>