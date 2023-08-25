<script lang="ts">
    import Task from "../models/task";
    import {longpress} from "../lib/actions";
    import Fa from "svelte-fa/src/fa.svelte";
    import {faCircleCheck} from "@fortawesome/free-regular-svg-icons/faCircleCheck";
    import {faCircle} from "@fortawesome/free-regular-svg-icons/faCircle";
    import {faChevronUp} from "@fortawesome/free-solid-svg-icons/faChevronUp";
    import {faChevronDown} from "@fortawesome/free-solid-svg-icons/faChevronDown";
    import {faUpLong} from "@fortawesome/free-solid-svg-icons/faUpLong";
    import {faDownLong} from "@fortawesome/free-solid-svg-icons/faDownLong";
    import {faXmark} from "@fortawesome/free-solid-svg-icons/faXmark";
    import {faBars} from "@fortawesome/free-solid-svg-icons/faBars";
    import {faClock} from "@fortawesome/free-regular-svg-icons/faClock";
    import {faGripLinesVertical} from "@fortawesome/free-solid-svg-icons/faGripLinesVertical";
    import {faClockRotateLeft} from "@fortawesome/free-solid-svg-icons/faClockRotateLeft";
    import {faAdd} from "@fortawesome/free-solid-svg-icons/faAdd";

    export let task: Task;
    export let index: number;
    export let refDuration: HTMLInputElement;
    export let refTitle: HTMLInputElement;
    export let actions;
    export let isDragging: boolean;

</script>

<div
        class="task"
        class:done="{task.done}"
        class:postponed="{task.postponed}"
        class:even="{index % 2 === 0}"
        class:isDragging="{isDragging}"
        on:dragend="{actions.dragEnd}"
        on:dragstart="{actions.dragStart}"
        data-task-id="{task.id}"
>
    <div class="number">{task.number || ''}</div>
    <div class="time">
        {#if task.startTime && task.finishTime}
            {task.startTime}-{task.finishTime}
        {:else if task.finishTime}
            {task.finishTime}
        {/if}
    </div>
    <div class="mainActions">
        <button on:click="{() => actions.delete(task, index)}"
                tabindex="-1"
        >
            <Fa icon="{faXmark}"/>
        </button>
        <button class="dragHandle"
                on:mousedown="{actions.dragHandleDown}"
                on:mouseup="{actions.dragHandleUp}"
                on:touchend|passive="{actions.dragHandleUp}"
                on:touchstart|passive="{actions.dragHandleDown}"
        >
            <Fa icon="{faBars}"/>
        </button>
        {#if task.postponed}
            <button class="restore"
                    on:click="{() => actions.restore(task, index)}"
            >
                <Fa icon="{faClockRotateLeft}"/>
            </button>
        {:else if !task.todoistTaskId}
            {#if task.title === ""}
                <span></span>
            {:else}
                <button class="create"
                        on:click="{() => actions.create(task, index)}"
                >
                    <Fa icon="{faAdd}"/>
                </button>
            {/if}
        {:else if !task.done}
            <button class="postpone"
                    use:longpress
                    on:shortpress="{() => actions.postponeTomorrow(task, index)}"
                    on:longpress="{() => actions.postponeSaturday(task, index)}"
            >
                <Fa icon="{faClock}"/>
            </button>
        {:else}
            <span></span>
        {/if}
        <button on:click="{() => actions.toggle(task, index)}"
                tabindex="-1"
        >
            {#if task.done}
                <Fa icon="{faCircleCheck}"/>
            {:else}
                <Fa icon="{faCircle}"/>
            {/if}
        </button>
    </div>
    <input bind:this="{refDuration}"
           bind:value="{task.duration}"
           class="duration"
           min="0"
           on:input="{actions.updated}"
           on:keydown="{(event) => actions.inputKeyDown(task, index, event, refDuration)}"
           on:keyup="{(event) => actions.inputKeyUp(task, index, event, refDuration)}"
           on:paste="{(event) => actions.paste(task, index, event)}"
           tabindex="{task.done ? -1 : 0}"
           type="number"
    />
    <a
            class="priority priority{task.todoistPriority}"
            class:priority1="{task.todoistPriority === 1}"
            class:priority2="{task.todoistPriority === 2}"
            class:priority3="{task.todoistPriority === 3}"
            class:priority4="{task.todoistPriority === 4}"
            href="{task.getUrl()}"
            tabindex="-1"
            target="_blank"
    >
        {#if task.todoistPriority > 0}
            <Fa icon="{faGripLinesVertical}"/>
        {/if}
    </a>
    <input bind:this="{refTitle}"
           bind:value="{task.title}"
           class="title"
           on:input="{actions.updated}"
           on:keydown="{(event) => actions.inputKeyDown(task, index, event, refTitle)}"
           on:keyup="{(event) => actions.inputKeyUp(task, index, event, refTitle)}"
           on:paste="{(event) => actions.paste(task, index, event)}"
           tabindex="{task.done ? -1 : 0}"
    />
    <div class="additionalActions">
        <button class="up"
                on:click="{() => actions.moveUp(task, index)}"
                tabindex="-1"
        >
            <Fa icon="{faChevronUp}"/>
        </button>
        <button class="top"
                on:click="{() => actions.moveTop(task, index)}"
                tabindex="-1"
        >
            <Fa icon="{faUpLong}"/>
        </button>
        <button class="up"
                on:click="{() => actions.moveDown(task, index)}"
                tabindex="-1"
        >
            <Fa icon="{faChevronDown}"/>
        </button>
        <button class="bottom"
                on:click="{() => actions.moveBottom(task, index)}"
                tabindex="-1"
        >
            <Fa icon="{faDownLong}"/>
        </button>
    </div>
</div>

<style>
    .task {
        align-items: center;
        display: grid;
        grid-template-columns:
            1.4rem
            6.2rem
            6.5rem
            2rem
            0.8rem
            minmax(10rem, auto)
            2.5rem;
        font-family: monospace;
        width: 100%;
        height: 1.7rem;
        line-height: 1.7rem;
    }

    .task.done,
    .task.postponed {
        opacity: .5;
    }

    .task.postponed {
        background-color: rgba(255, 255, 180, 30%);
    }

    .task.even.postponed {
        background-color: rgba(255, 255, 180, 60%);
    }

    .task.even {
        background-color: #eeeeee;
    }

    .task.isDragging {
        opacity: 0.5;
        background-color: #ffffb4;
    }

    .task > div {
        text-align: center;
    }

    .number {
        font-size: 0.9rem;
        color: grey;
        background-color: white;
    }

    button {
        background-color: transparent;
        border-style: none;
        color: var(--text-color);
        cursor: pointer;
    }

    input {
        background: transparent;
        border-style: none;
        color: var(--text-color);
        font-family: monospace;
        outline-color: #f00;
        padding: 0;
    }

    .task.done .title {
        text-decoration: line-through;
    }

    .duration {
        text-align: center;
    }

    .dragHandle {
        cursor: grab;
    }

    .time {
        white-space: nowrap;
    }

    .mainActions {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
    }

    .additionalActions {
        display: grid;
        grid-template-columns: 1rem 0.8rem;
        grid-template-rows: 0.4rem 0.7rem;
        margin-left: 0.5rem;
    }

    .additionalActions button {
        font-size: 0.8rem;
    }

    .priority {
        text-align: center;
        opacity: 0.8;
    }

    .priority1, .priority1:visited, .priority1:active {
        color: #808080;
    }

    .priority2, .priority2:visited, .priority2:active {
        color: #246fe0;
    }

    .priority3, .priority3:visited, .priority3:active {
        color: #eb8909;
    }

    .priority4, .priority4:visited, .priority4:active {
        color: #d1453b;
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
