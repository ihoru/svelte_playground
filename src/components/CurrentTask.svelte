<script lang="ts">
    import Task from "../models/task";
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
    import Button from "./Button.svelte";
    import {faLocationDot} from "@fortawesome/free-solid-svg-icons/faLocationDot";
    import {faCirclePlay} from "@fortawesome/free-regular-svg-icons/faCirclePlay";
    import {doubleclicker} from "../lib/actions";
    import {tick} from "svelte";
    import {faCalendarDays} from "@fortawesome/free-regular-svg-icons/faCalendarDays";

    export let task: Task;
    export let index: number;
    export let refDuration: HTMLInputElement;
    export let refTitle: HTMLInputElement;
    export let actions;
    export let isDragging: boolean;
    export let hasTimer: boolean;
    export let todoistAPIAvailable: boolean;

    let showTitleInput = false;

    async function toggleTitleInput(e) {
        showTitleInput = !showTitleInput;
        if (showTitleInput) {
            await tick();
            refTitle.focus();
        }
    }

    function titleInputBlur(event) {
        showTitleInput = false;
        actions.titleInputBlur(task, event);
    }

    async function titleInputFocus(event) {
        showTitleInput = true;
        refTitle.setSelectionRange(0, 0);
        actions.inputFocus(task, event);
    }


</script>

<div
        class="task"
        class:done="{task.done}"
        class:even="{index % 2 === 0}"
        class:isDragging="{isDragging}"
        class:postponed="{!!task.postponed}"
        class:recentlyChanged="{task.recentlyChanged}"
        data-task-id="{task.id}"
        on:dragend="{actions.dragEnd}"
        on:dragstart="{actions.dragStart}"
>
    <div class="number">{task.number || ''}</div>
    <div class="time">
        {#if task.postponed}
            {task.postponed}
        {:else if task.startTime}
            {task.startTime}
        {:else if task.finishTime}
            {task.finishTime}
        {/if}
    </div>
    <div class="mainActions">
        <button
                on:click="{() => actions.delete(task)}"
                tabindex="-1"
        >
            <Fa icon="{faXmark}"/>
        </button>
        <button
                class="dragHandle"
                on:mousedown="{actions.dragHandleDown}"
                on:mouseup="{actions.dragHandleUp}"
                on:touchend|passive="{actions.dragHandleUp}"
                on:touchstart|passive="{actions.dragHandleDown}"
                tabindex="-1"
        >
            <Fa icon="{faBars}"/>
        </button>
        {#if task.title !== "" && task.todoistTaskId}
            <button
                    tabindex="-1" use:doubleclicker
                    class:emptyTimer="{!hasTimer}"
                    on:singleclick="{() => actions.startTimer(task)}"
                    on:doubleclick="{() => actions.forgetTimer(task)}"
            >
                <Fa icon="{faCirclePlay}"/>
            </button>
        {:else}
            <span></span>
        {/if}
        {#if task.postponed}
            <button
                    class="restore"
                    on:click="{() => actions.restore(task)}"
                    tabindex="-1"
            >
                <Fa icon="{faClockRotateLeft}"/>
            </button>
        {:else if !task.todoistTaskId && !task.done}
            {#if task.title === "" || task.eventId}
                <span></span>
            {:else if todoistAPIAvailable}
                <button
                        class="create"
                        on:click="{() => actions.create(task)}"
                        tabindex="-1"
                >
                    <Fa icon="{faAdd}"/>
                </button>
            {/if}
        {:else if task.todoistTaskId && !task.done && !task.postponed}
            <Button
                    on:singleclick="{() => actions.postponeTomorrow(task)}"
                    on:doubleclick="{() => actions.postponeSaturday(task)}"
                    on:tripleclick="{() => actions.postponeSunday(task)}"
                    tabindex="-1"
            >
                <Fa icon="{faClock}"/>
            </Button>
        {:else}
            <span></span>
        {/if}
        {#if task.title !== "" && !task.postponed}
            <button
                    on:click="{() => actions.toggle(task)}"
                    tabindex="-1"
            >
                {#if task.done}
                    <Fa icon="{faCircleCheck}"/>
                {:else}
                    <Fa icon="{faCircle}"/>
                {/if}
            </button>
        {:else}
            <span></span>
        {/if}
    </div>
    <input
            bind:this="{refDuration}"
            bind:value="{task.duration}"
            class="durationInput"
            enterkeyhint="Next"
            min="0"
            on:focus="{(event) => actions.inputFocus(task, event)}"
            on:input="{actions.updated}"
            on:keydown="{(event) => actions.inputKeyDown(task, event, refDuration)}"
            on:keyup="{(event) => actions.inputKeyUp(task, event, refDuration)}"
            on:paste="{(event) => actions.paste(task, event)}"
            tabindex="{task.done ? -1 : 0}"
            type="number"
    />
    <a
            class="priority"
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
        {:else if task.eventLink}
            <Fa icon="{faCalendarDays}"/>
        {/if}
    </a>
    <div class="titleContainer">
        <span
                on:click="{toggleTitleInput}"
                style:display="{showTitleInput ? 'none' : 'block'}"
        >
            <span class:startTimePassed="{task.eventStartTimePassed}">
                {task.eventStartTime || ''}
            </span>
            {#if task.title}
                {task.title}
            {:else}
                &nbsp;
            {/if}
        </span>
        <input
                bind:this="{refTitle}"
                bind:value="{task.title}"
                class="titleInput"
                enterkeyhint="Enter"
                on:blur="{titleInputBlur}"
                on:focus="{titleInputFocus}"
                on:input="{actions.updated}"
                on:keydown="{(event) => actions.inputKeyDown(task, event, refTitle)}"
                on:keyup="{(event) => actions.inputKeyUp(task, event, refTitle)}"
                on:paste="{(event) => actions.paste(task, event)}"
                style:display="{showTitleInput ? 'block' : 'none'}"
                tabindex="{task.done ? -1 : 0}"
        />
    </div>
    <div class="additionalActions">
        <button
                class="afterFocused"
                on:click="{() => actions.moveAfterFocused(task)}"
                tabindex="-1"
        >
            <Fa icon="{faLocationDot}"/>
        </button>
        <button
                class="top"
                on:click="{() => actions.moveTop(task)}"
                tabindex="-1"
        >
            <Fa icon="{faUpLong}"/>
        </button>
        <button
                class="bottom"
                on:click="{() => actions.moveBottom(task)}"
                tabindex="-1"
        >
            <Fa icon="{faDownLong}"/>
        </button>
        <button
                class="up"
                on:click="{() => actions.moveDown(task)}"
                tabindex="-1"
        >
            <Fa icon="{faChevronDown}"/>
        </button>
        <button
                class="up"
                on:click="{() => actions.moveUp(task)}"
                tabindex="-1"
        >
            <Fa icon="{faChevronUp}"/>
        </button>
    </div>
</div>

<style>
    .task {
        align-items: center;
        display: grid;
        grid-template-columns:
            1.4rem              /* .number */
            3.5rem              /* .time */
            7.5rem                /* .mainActions */
            2rem                /* .duration */
            1rem              /* .priority */
            minmax(10rem, auto)  /* .title */
            6.5rem /* .additionalActions */;
        font-family: monospace;
        width: 100%;
        height: 1.7rem;
        line-height: 1.7rem;
    }

    .task.done,
    .task.postponed {
        opacity: .5;
    }

    .task.even {
        background-color: #eeeeee;
    }

    .task.postponed {
        background-color: rgba(255, 255, 180, 30%);
    }

    .task.recentlyChanged {
        background-color: rgba(180, 188, 255, 0.3);
    }

    .task.isDragging {
        opacity: 0.5;
        background-color: #c3ffb4;
    }

    .task > div {
        text-align: center;
    }

    .number {
        font-size: 0.9rem;
        color: grey;
        background-color: white;
    }

    input {
        background: transparent;
        border-style: none;
        color: var(--text-color);
        font-family: monospace;
        outline-color: #f00;
        padding: 0;
    }

    .task div.titleContainer {
        text-align: left;
    }

    .task div.titleContainer span {
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
        font-size: 1rem;
    }

    .startTimePassed {
        color: red;
    }

    .titleInput {
        width: 100%;
    }

    .task.done .titleContainer span {
        text-decoration: line-through;
    }

    .durationInput {
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
        grid-template-columns: repeat(5, 1fr);
    }

    .emptyTimer {
        opacity: 0.3;
    }

    .additionalActions {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
    }

    .priority {
        text-align: center;
        opacity: 0.8;
    }

    .priority, .priority:visited, .priority:active {
        color: rgb(26, 115, 232);
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

    .task :global(button) {
        background-color: transparent;
        border-style: none;
        padding: 0;
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

    @media all and (max-width: 500px) {
        .additionalActions {
            display: none;
        }
    }

</style>
