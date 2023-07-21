<script lang="ts">
    import Task from "../models/task";

    export let task: Task;
    export let index: number;
    export let refDuration: HTMLInputElement;
    export let refTitle: HTMLInputElement;
    export let actions;
    export let startTime = "";
    export let finishTime = "";

</script>

<li
        class="task"
        class:done="{task.done}"
>
    <div class="actions">
        <input bind:checked="{task.done}" tabindex="-1"
               type="checkbox"
        >
        <button on:click="{() => actions.delete(task, index)}"
                tabindex="-1"
        >&cross;
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
    </div>
    <div class="content">
        <span class="start">{finishTime}</span>
        <input bind:this="{refDuration}"
               bind:value="{task.duration}" class="duration"
               data-task-id="{task.id}"
               min="0"
               on:keydown={(event) => actions.inputKey(task, index, event, refDuration)}
               tabindex="{task.done ? -1 : 0}"
               type="number"
        />
        <span class="finish">{startTime}</span>
        <input bind:this="{refTitle}"
               bind:value="{task.title}"
               class="title"
               data-task-id="{task.id}"
               on:keydown={(event) => actions.inputKey(task, index, event, refTitle)}
               on:paste="{(event) => actions.paste(task, index, event)}"
               tabindex="{task.done ? -1 : 0}"
        />
    </div>
</li>

<style>

    .task {
        margin: 2px;
        padding: 5px;
        border: 1px solid #ccc;
        display: flex;
    }

    .task .actions {
        flex: 1;
    }

    .task > * {
        display: flex;
        justify-content: space-evenly;
    }

    .task .content {
        flex: 3;
    }

    .task .content input {
        border: 1px solid #eee;
        padding: 3px;
    }

    .task .content .duration {
        width: 30px;
        margin-right: 3px;
        text-align: center;
    }

    .task .content .title {
        width: 100%;
    }

    .task .content .start,
    .task .content .finish {
        width: 50px;
        text-align: center;
        border: 1px solid #eee;
        margin-right: 3px;
    }

    .task .content .start {
    }

    .task .content .finish {
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
