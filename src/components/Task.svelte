<script lang="ts">
    import Task from "../models/task";

    export let task: Task;
    export let index: number;
    export let refDuration: HTMLInputElement;
    export let refTitle: HTMLInputElement;
    export let actions;

</script>

<li
        class="task"
        class:done="{task.done}"
>
    <span class="number">{task.number || ''}</span>
    <button on:click="{() => actions.toggle(task, index)}"
            tabindex="-1"
    >
        {#if task.done}
            &checkmark;
        {:else}
            &circledast;
        {/if}
    </button>
    <button on:click="{() => actions.moveUp(task, index)}"
            tabindex="-1"
    >&uparrow;
    </button>
    <button on:click="{() => actions.moveDown(task, index)}"
            tabindex="-1"
    >&downarrow;
    </button>
    <button on:click="{() => actions.moveTop(task, index)}"
            tabindex="-1"
    >&upuparrows;
    </button>
    <button on:click="{() => actions.moveBottom(task, index)}"
            tabindex="-1"
    >&downdownarrows;
    </button>
    <span class="start">{task.startTime || ''}</span>
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
    <span class="finish">{task.finishTime || ''}</span>
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
    >&cross;
    </button>
</li>

<style>

    .task {
        padding: 1px 0;
        display: flex;
    }

    .task > * {
        margin-right: 3px;
    }

    .task > *:last-child {
        margin-right: 0;
    }

    .number {
        width: 2rem;
        text-align: center;
        padding-top: 2px;
    }

    .task input {
        border: 1px solid #eee;
        padding: 3px;
        font-size: 15px;
    }

    .task .duration {
        width: 30px;
        margin-right: 3px;
        text-align: center;
    }

    .task .title {
        width: 100%;
    }

    .task .start,
    .task .finish {
        width: 50px;
        text-align: center;
        border: 1px solid #eee;
        margin-right: 3px;
    }

    .task.done {
        opacity: .5;
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
