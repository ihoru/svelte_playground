<script lang="ts">
    import Help from "./components/Help.svelte";
    import CurrentTasks from "./components/CurrentTasks.svelte";
    import type Task from "./models/task";

    let currentTasks: Array<Task> = [];
    let tmpCurrentTasks = localStorage.getItem("tasks");
    try {
        currentTasks = JSON.parse(tmpCurrentTasks);
    } catch (e) {
    }
</script>

<CurrentTasks tasks="{currentTasks}"/>
<Help/>

<style>
</style>

