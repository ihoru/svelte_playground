<script lang="ts">
    import Task from "../models/task";
    import Fa from "svelte-fa/src/fa.svelte";
    import {faChevronDown, faChevronUp, faDownLong, faTrash, faUpLong} from "@fortawesome/free-solid-svg-icons";
    import {faCircle, faCircleCheck} from "@fortawesome/free-regular-svg-icons";

    export let task: Task;
    export let index: number;
    export let refDuration: HTMLInputElement;
    export let refTitle: HTMLInputElement;
    export let actions;

</script>

<li
        class="task"
        class:done="{task.done}"
        class:even="{index % 2 === 0}"
>
    <div class="number">{task.number || ''}</div>
    <button on:click="{() => actions.toggle(task, index)}"
            tabindex="-1"
    >
        {#if task.done}
            <Fa icon="{faCircleCheck}" fw/>
        {:else}
            <Fa icon="{faCircle}" fw/>
        {/if}
    </button>
    <button on:click="{() => actions.moveUp(task, index)}"
            tabindex="-1"
    >
        <Fa fw icon="{faChevronUp}"/>
    </button>
    <button on:click="{() => actions.moveDown(task, index)}"
            tabindex="-1"
    >
        <Fa fw icon="{faChevronDown}"/>
    </button>
    <button on:click="{() => actions.moveTop(task, index)}"
            tabindex="-1"
    >
        <Fa fw icon="{faUpLong}"/>
    </button>
    <button on:click="{() => actions.moveBottom(task, index)}"
            tabindex="-1"
    >
        <Fa fw icon="{faDownLong}"/>
    </button>
    <div class="start">{task.startTime || ''}</div>
    <a class="priority" href="{task.getUrl()}">{task.todoistPriority}</a>
    <input bind:this="{refDuration}"
           bind:value="{task.duration}"
           class="duration"
           min="0"
           on:input={actions.updated}
           on:keydown={(event) => actions.inputKeyDown(task, index, event, refDuration)}
           on:keyup={(event) => actions.inputKeyUp(task, index, event, refDuration)}
           on:paste="{(event) => actions.paste(task, index, event)}"
           tabindex="{task.done ? -1 : 0}"
           type="number"
    />
    <div class="finish">{task.finishTime || ''}</div>
    <input bind:this="{refTitle}"
           bind:value="{task.title}"
           class="title"
           on:change={actions.updated}
           on:keydown={(event) => actions.inputKeyDown(task, index, event, refTitle)}
           on:keyup={(event) => actions.inputKeyUp(task, index, event, refTitle)}
           on:paste="{(event) => actions.paste(task, index, event)}"
           tabindex="{task.done ? -1 : 0}"
    />
    <button on:click="{() => actions.delete(task, index)}"
            tabindex="-1"
    >
        <Fa icon="{faTrash}"/>
    </button>
</li>

<style>

    .task {
        --text-color: #333;

        align-items: baseline;
        color: var(--text-color);
        display: flex;
        font-family: monospace;
    }

    .task.done {
        opacity: .5;
    }

    .task.even {
        background: #eeeeee;
    }

    .task > * {
        margin-right: 5px;
    }

    .task > *:last-child {
        margin-right: 0;
    }

    .task .number {
        width: 2rem;
        text-align: center;
    }

    .task input {
        background: transparent;
        border-style: none;
        color: var(--text-color);
        font-family: monospace;
        outline-color: #f00;
        padding: 3px;
    }

    .task.done .title {
        text-decoration: line-through;
    }

    .task button {
        background-color: transparent;
        border-style: none;
        color: var(--text-color);
        width: 2rem;
    }

    .task .duration {
        text-align: center;
        width: 30px;
    }

    .task .title {
        width: 100%;
    }

    .task .start,
    .task .finish {
        text-align: center;
        width: 5rem;
    }

    /*
    * Hide number input arrows
    */
    input::-webkit-outer-spin-button, input::-webkit-inner-spin-button {
        /* Chrome, Safari, Edge, Opera */
        -webkit-appearance: none;
        margin: 0;
    }

    input[type=number] {
        /* Firefox */
        -moz-appearance: textfield;
    }

</style>
