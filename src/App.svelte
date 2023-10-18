<script lang="ts">
    import CurrentTasks from "./components/CurrentTasks.svelte";
    import Task from "./models/task";
    import "reflect-metadata";
    import {plainToInstance} from "class-transformer";
    import * as storage from "./lib/storage";
    import TTFavorite from "./models/TTFavorite";

    let currentTasks: Array<Task> = [];
    let currentTasksTimestamp: number = 0;
    let timerURLs = {};
    let timerURLsTimestamp: number = 0;
    let togglTrackFavorites: Array<TTFavorite> = [];
    let togglTrackFavoritesTimestamp: number = 0;
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
        let changed = false;
        // I don't remember, why did I write this code here:
        // tasks = JSON.parse(JSON.stringify(tasks));
        const ids = new Set();
        const newTasks = tasks.filter((task: Task) => {
            if (task.recentlyChanged) {
                changed = true;
            }
            task.recentlyChanged = false;
            if (ids.has(task.id)) {
                changed = true;
                // prevent saving duplicate elements (might happen during development)
                console.error(`Task.id=${task.id} was duplicated!`, task);
                return false;
            }
            ids.add(task.id);
            return true;
        });
        if (changed) {
            tasks = newTasks;
        }
        saveLocalCurrentTasks(tasks, timestamp);
        saveServerCurrentTasks(tasks, timestamp, currentTasksTimestamp);
    }

    async function loadTimerURLs() {
        let json;
        try {
            json = await storage.get("timer_urls");
        } catch (e) {
            storageError = e.toString();
            console.error(e);
            return;
        }
        if (json.ok) {
            timerURLs = json.data;
            timerURLsTimestamp = json.timestamp;
        }
    }

    async function saveTimerURLs() {
        const timestamp = (new Date()).getTime();
        storageError = null;
        let json;
        try {
            json = await storage.set("timer_urls", timestamp, timerURLsTimestamp, timerURLs);
        } catch (e) {
            storageError = e.toString();
            console.error(e);
            return;
        }
        if (json.ok) {
            timerURLsTimestamp = timestamp;
        } else {
            timerURLs = json.data;
            timerURLsTimestamp = json.timestamp;
            alert("Server has newer timer URLs data");
        }
    }

    function saveTimerURL(todoistTaskId, url) {
        if (url) {
            timerURLs[todoistTaskId] = url;
        } else {
            if (!timerURLs[todoistTaskId]) {
                return;
            }
            delete timerURLs[todoistTaskId];
        }
        saveTimerURLs();
    }

    async function loadTogglTrackFavorites() {
        let json;
        try {
            json = await storage.get("toggle_track_favorites");
        } catch (e) {
            storageError = e.toString();
            console.error(e);
            return;
        }
        if (json.ok) {
            applyTogglTrackFavorites(json);
        }
    }

    async function saveTogglTrackFavorites() {
        togglTrackFavorites = togglTrackFavorites.sort((a, b) => a.order - b.order);
        let order = 10;
        for (const item of togglTrackFavorites) {
            item.order = order;
            order += 10;
        }
        togglTrackFavorites = togglTrackFavorites;
        const timestamp = (new Date()).getTime();
        storageError = null;
        let json;
        try {
            json = await storage.set("toggle_track_favorites", timestamp, togglTrackFavoritesTimestamp, togglTrackFavorites);
        } catch (e) {
            storageError = e.toString();
            console.error(e);
            return;
        }
        if (json.ok) {
            togglTrackFavoritesTimestamp = timestamp;
        } else {
            applyTogglTrackFavorites(json);
            alert("Server has newer Toggl Track Favorites data");
        }
    }

    function applyTogglTrackFavorites(json) {
        togglTrackFavorites = plainToInstance<TTFavorite, Array<object>>(TTFavorite, json.data);
        togglTrackFavoritesTimestamp = json.timestamp;
    }

    loadLocalCurrentTasks();
    loadServerCurrentTasks();
    loadTimerURLs();
    loadTogglTrackFavorites();

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
            saveTasks="{saveCurrentTasks}"
            {saveTimerURL}
            {saveTogglTrackFavorites}
            tasks="{currentTasks}"
            {timerURLs}
            {togglTrackFavorites}
    ></CurrentTasks>
</main>

<style>
    .error {
        text-align: center;
        margin: 0.5rem 0;
    }
</style>