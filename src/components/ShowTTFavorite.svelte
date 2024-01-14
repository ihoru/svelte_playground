<script lang="ts">
    import TTFavorite from "../models/TTFavorite";
    import Fa from "svelte-fa/src/fa.svelte";
    import {faPlay} from "@fortawesome/free-solid-svg-icons/faPlay";

    export let item: TTFavorite;
    // noinspection JSUnusedGlobalSymbols
    export let index: number;
    // noinspection JSUnusedGlobalSymbols
    export let deleteItem;

    function open() {
        if (!item.url) {
            return;
        }
        window.open(item.url);
    }
</script>

<div
        class="item"
>
    <button
            class:emptyUrl="{!item.url}"
            on:click="{open}"
    >
        <Fa icon="{faPlay}"/>
        <span>
            {item.title}
        </span>
    </button>
</div>

<style>
    .item {
        line-height: 2rem;
    }

    .emptyUrl {
        opacity: 0.5;
    }

    button {
        border-style: none;
        background: transparent;
        padding: 0.5rem 1rem;
    }

    span {
        margin-left: 0.5rem;
    }

</style>
