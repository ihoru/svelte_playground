<script lang="ts">
    import Help from "./components/Help.svelte";
    import CurrentTasks from "./components/CurrentTasks.svelte";
    import Task from "./models/task";
    import "reflect-metadata";
    import {plainToInstance} from "class-transformer";
    import * as storage from "./lib/storage";

    let currentTasks: Array<Task> = [];
    let currentTasksTimestamp: number = 0;
    let ignoreNextCurrentTasksUpdate: boolean = false;

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
        const json = await storage.get("tasks", currentTasksTimestamp);
        console.debug("server: loaded");
        if (json) {
            applyCurrentTasksFromServer(json);
        }
    }

    async function saveServerCurrentTasks(tasks: string, timestamp: number, oldTimestamp: number) {
        console.debug("server: save");
        const json = await storage.set("tasks", timestamp, oldTimestamp, tasks);
        if (json.ok) {
            currentTasksTimestamp = timestamp;
        } else {
            applyCurrentTasksFromServer(json);
            alert("Server has newer data");
        }
        console.debug("server: saved");
    }

    function applyCurrentTasksFromServer(json: object) {
        ignoreNextCurrentTasksUpdate = true;
        currentTasksTimestamp = parseInt(json.timestamp) || 0;
        currentTasks = plainToInstance<Task, Array<object>>(Task, json.data);
        saveLocalCurrentTasks(currentTasks, currentTasksTimestamp);
    }

    function saveCurrentTasks(tasks: Array<Task>) {
        console.info("! saveCurrentTasks");
        const timestamp = (new Date()).getTime();
        saveLocalCurrentTasks(tasks, timestamp);
        saveServerCurrentTasks(tasks, timestamp, currentTasksTimestamp);
    }

    loadLocalCurrentTasks();
    loadServerCurrentTasks();

</script>

<main>
    <CurrentTasks
            save="{saveCurrentTasks}"
            bind:ignoreNextTasksUpdate="{ignoreNextCurrentTasksUpdate}"
            tasks="{currentTasks}"
    ></CurrentTasks>
    <Help/>
</main>
