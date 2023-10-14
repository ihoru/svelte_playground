<script lang="ts">
    import TTFavorite from "../models/TTFavorite";
    import Fa from "svelte-fa/src/fa.svelte";
    import {faPlay} from "@fortawesome/free-solid-svg-icons/faPlay";

    export let item: TTFavorite;
    export let index: number;
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
    </button>
    <span>
        {item.title}
    </span>
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

</style>
