<script lang="ts">
    import {createEventDispatcher} from "svelte";

    const dispatcher = createEventDispatcher();

    let clicks: number;
    let timeout: number;
    let dt: Date;
    export let delay = 600;

    function now(): number {
        return (new Date()).getTime();
    }

    function dispatch(name) {
        return () => {
            dispatcher(name);
            clearTimeout(timeout);
            clicks = dt = timeout = null;
        };
    }

    function handleClickType() {
        if (clicks == 1) {
            clearTimeout(timeout);
            clicks = 2;
            timeout = setTimeout(dispatch("doubleclick"), delay - (now() - dt));
            return;
        } else if (clicks == 2) {
            dispatch("tripleclick")();
            return;
        }
        clicks = 1;
        dt = now();
        timeout = setTimeout(dispatch("singleclick"), delay);
    }
</script>

<button {...$$props}
        on:click={handleClickType}
        on:dblclick|preventDefault
>
    <slot/>
</button>
