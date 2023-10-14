<script lang="ts">
    import TTFavorite from "../models/TTFavorite";
    import Fa from "svelte-fa/src/fa.svelte";
    import {faTrashCan} from "@fortawesome/free-regular-svg-icons/faTrashCan";

    export let item: TTFavorite;
    export let index: number;
    export let deleteItem;

</script>

<div
        class="item"
        class:even="{index % 2 === 0}"
>
    <input
            bind:value="{item.order}"
            class="order"
            enterkeyhint="Next"
            min="0"
            type="number"
    />
    <input
            bind:value="{item.title}"
            class="title"
            enterkeyhint="Next"
            type="text"
    />
    <input
            bind:value="{item.url}"
            class="url"
            enterkeyhint="Next"
            on:focus="{(event) => event.target.select()}"
            type="url"
    />
    <button
            class="delete"
            on:click="{deleteItem}"
    >
        <Fa icon="{faTrashCan}"/>
    </button>
</div>

<style>
    .item {
        align-items: center;
        display: grid;
        grid-template-columns:
            3rem
            10rem
            10rem
            3rem;
        width: 100%;
        height: 2rem;
    }

    .item.even {
        background-color: #eeeeee;
    }

    input, button {
        height: 2rem;
    }

    input {
        background: transparent;
        border-style: none;
        color: var(--text-color);
        font-family: monospace;
        outline-color: #f00;
        padding: 0;
        margin-right: 0.5rem;
    }
</style>
