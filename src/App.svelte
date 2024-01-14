<script lang="ts">
    import CurrentTasks from "./components/CurrentTasks.svelte";
    import Task from "./models/task";
    import "reflect-metadata";
    import {plainToInstance} from "class-transformer";
    import * as storage from "./lib/storage";
    import TTFavorite from "./models/TTFavorite";

    let currentTasks: Task[] = [];
    let currentTasksTimestamp: number = 0;
    let timerURLs: Object = {};
    let timerURLsTimestamp: number = 0;
    let togglTrackFavorites: Array<TTFavorite> = [];
    let togglTrackFavoritesTimestamp: number = 0;
    let ignoreNextCurrentTasksUpdate: boolean = false;
    let lastUpdateTimestamp: number = 0;
    let storageError: string | null = null;

    function loadLocalCurrentTasks() {
        // console.log("local: load");
        currentTasksTimestamp = parseInt(localStorage.getItem("tasks_timestamp")) || 0;
        let data: Array<object>;
        try {
            data = JSON.parse(localStorage.getItem("tasks") || "[]");
        } catch (e) {
        }
        ignoreNextCurrentTasksUpdate = true;
        currentTasks = plainToInstance<Task, object>(Task, data);
    }

    function saveLocalCurrentTasks(tasks: Array<Task>, timestamp: number) {
        // console.log("local: save");
        localStorage.setItem("tasks", JSON.stringify(tasks));
        localStorage.setItem("tasks_timestamp", timestamp.toString());
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

    async function saveServerCurrentTasks(tasks: Task[], timestamp: number, oldTimestamp: number) {
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
            lastUpdateTimestamp = Date.now();
        } else {
            applyCurrentTasksFromServer(json);
        }
        console.debug("server: saved");
    }

    function applyCurrentTasksFromServer(json: object) {
        ignoreNextCurrentTasksUpdate = true;
        currentTasksTimestamp = parseInt(json.timestamp) || 0;
        lastUpdateTimestamp = Date.now();
        currentTasks = plainToInstance<Task, Array<object>>(Task, json.data);
        saveLocalCurrentTasks(currentTasks, currentTasksTimestamp);
    }

    function saveCurrentTasks(tasks: Array<Task>) {
        console.info("! saveCurrentTasks");
        const timestamp = Date.now();
        let changed = false;
        tasks = JSON.parse(JSON.stringify(tasks)); // To avoid changing current data
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

    function loadLocalTimerURLs() {
        // console.log("local: load");
        timerURLsTimestamp = parseInt(localStorage.getItem("timer_urls_timestamp")) || 0;
        let data: Array<object>;
        try {
            data = JSON.parse(localStorage.getItem("timer_urls") || "[]");
        } catch (e) {
        }
        timerURLs = plainToInstance<TTFavorite, object>(TTFavorite, data);
    }

    function saveLocalTimerURLs() {
        // console.log("local: save");
        localStorage.setItem("timer_urls", JSON.stringify(timerURLs));
        localStorage.setItem("timer_urls_timestamp", timerURLsTimestamp.toString());
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
            saveLocalTimerURLs();
        }
    }

    async function saveTimerURLs() {
        const timestamp = Date.now();
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
            saveLocalTimerURLs();
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
        timerURLs = timerURLs;
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
        const timestamp = Date.now();
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
        togglTrackFavorites = plainToInstance<TTFavorite, object>(TTFavorite, json.data);
        togglTrackFavoritesTimestamp = json.timestamp;
    }

    loadLocalCurrentTasks();
    loadServerCurrentTasks();
    loadLocalTimerURLs();
    loadTimerURLs();
    loadTogglTrackFavorites();

    function onWindowFocus() {
        console.debug("window: focus");
        const timestamp = Date.now();
        if (timestamp - lastUpdateTimestamp > 1000 * 60 * 5) {
            lastUpdateTimestamp = Date.now();
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