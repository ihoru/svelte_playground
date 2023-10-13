export function longpress(node: Node, threshold: number = 300) {
    let dt: Date;

    const onMouseDown = (event: MouseEvent) => {
        event.preventDefault();
        dt = new Date();
    };
    const onMouseUp = (event: MouseEvent) => {
        event.preventDefault();
        if (!dt) {
            return;
        }
        const diff = (new Date()).getTime() - dt.getTime();
        if (diff >= threshold) {
            node.dispatchEvent(new CustomEvent("longpress"));
        } else {
            node.dispatchEvent(new CustomEvent("shortpress"));
        }
        dt = null;
    };

    node.addEventListener("mousedown", onMouseDown);
    node.addEventListener("mouseup", onMouseUp);

    node.addEventListener("touchstart", onMouseDown, {passive: false});
    node.addEventListener("touchend", onMouseUp, {passive: false});

    return {
        destroy() {
            node.removeEventListener("mousedown", onMouseDown);
            node.removeEventListener("mouseup", onMouseUp);

            node.removeEventListener("touchstart", onMouseDown);
            node.removeEventListener("touchend", onMouseUp);
        },
    };
}

export function doubleclicker(node: Node, threshold: number = 300) {
    let timeout: number;

    function onClick() {
        if (timeout) {
            clearTimeout(timeout);
            timeout = null;
            node.dispatchEvent(new CustomEvent("doubleclick"));
            return;
        }

        timeout = setTimeout(() => {
            timeout = null;
            node.dispatchEvent(new CustomEvent("singleclick"));
        }, threshold);
    }

    node.addEventListener("click", onClick);

    return {
        destroy() {
            node.removeEventListener("click", onClick);
        },
    };
}
