<script lang="ts">
    export let showModal: Boolean;

    let dialog: HTMLDialogElement;

    $: if (dialog && showModal) {
        dialog.showModal();
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
<dialog
        bind:this={dialog}
        on:click|self={() => dialog.close()}
        on:close={() => (showModal = false)}
>
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div on:click|stopPropagation>
        <slot name="header"/>
        <hr/>
        <slot/>
        <hr/>
        <slot name="footer">
            <!-- svelte-ignore a11y-autofocus -->
            <button autofocus on:click={() => dialog.close()}>Close</button>
        </slot>
    </div>
</dialog>

<style>
    dialog {
        border-radius: 1rem;
        border: none;
        padding: 1rem;
    }

    dialog::backdrop {
        background: rgba(0, 0, 0, 0.3);
    }

    dialog > div {
        padding: 1rem;
    }

    dialog[open] {
        animation: zoom 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes zoom {
        from {
            transform: scale(0.95);
        }
        to {
            transform: scale(1);
        }
    }

    dialog[open]::backdrop {
        animation: fade 0.2s ease-out;
    }

    @keyframes fade {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }

    button {
        display: block;
        padding: 0.5rem 1rem;
        margin: 0.5rem auto 0 auto;
    }

    hr {
        border-style: none;
        border-top: 1px solid #ccc;
        margin: 1rem 0;
    }
</style>
