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
    const onMouseMove = (event: MouseEvent) => {
        if (dt) {
            dt = null;
        }
    };

    node.addEventListener("mousedown", onMouseDown);
    node.addEventListener("mouseup", onMouseUp);
    node.addEventListener("mousemove", onMouseMove);

    node.addEventListener("touchstart", onMouseDown, {passive: false});
    node.addEventListener("touchend", onMouseUp, {passive: false});
    node.addEventListener("touchmove", onMouseMove, {passive: false});

    return {
        destroy() {
            node.removeEventListener("mousedown", onMouseDown);
            node.removeEventListener("mouseup", onMouseUp);
            node.removeEventListener("mousemove", onMouseMove);

            node.removeEventListener("touchstart", onMouseDown);
            node.removeEventListener("touchend", onMouseUp);
            node.removeEventListener("touchmove", onMouseMove);
        },
    };
}
