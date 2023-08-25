export function longpress(node: Node, threshold: number = 300) {
    const onMouseDown = (event) => {
        event.preventDefault();

        const timeout = setTimeout(() => {
            node.dispatchEvent(new CustomEvent("longpress"));
            removeListeners();
        }, threshold);

        const cancel = () => {
            clearTimeout(timeout);
            node.dispatchEvent(new CustomEvent("shortpress"));
            removeListeners();
        };

        const removeListeners = () => {
            node.removeEventListener("mousemove", cancel);
            node.removeEventListener("mouseup", cancel);

            node.removeEventListener("touchmove", cancel);
            node.removeEventListener("touchend", cancel);
        };

        node.addEventListener("mousemove", cancel);
        node.addEventListener("mouseup", cancel);

        node.addEventListener("touchmove", cancel, {passive: false});
        node.addEventListener("touchend", cancel, {passive: false});
    };

    node.addEventListener("mousedown", onMouseDown);
    node.addEventListener("touchstart", onMouseDown, {passive: false});

    return {
        destroy() {
            node.removeEventListener("mousedown", onMouseDown);
            node.removeEventListener("touchstart", onMouseDown);
        },
    };
}
