<script lang="ts">
    import Help from "./components/Help.svelte";
    import CurrentTasks from "./components/CurrentTasks.svelte";
    import Task from "./models/task";
    import "reflect-metadata";
    import {plainToInstance} from "class-transformer";

    // Restore tasks from local storage
    let currentTasks: Array<Task> = [];
    let tmpCurrentTasks = localStorage.getItem("tasks") || "[]";
    try {
        tmpCurrentTasks = JSON.parse(tmpCurrentTasks);
    } catch (e) {
    }
    currentTasks = plainToInstance<Task>(Task, tmpCurrentTasks);

    function saveCurrentTasks(tasks: Array<Task>) {
        localStorage.setItem("tasks", JSON.stringify(tasks));
    }
</script>

<main>
    <CurrentTasks
            save="{saveCurrentTasks}"
            tasks="{currentTasks}"
    ></CurrentTasks>
    <Help/>
</main>
