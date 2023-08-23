export function longpress(node: Node, threshold: number = 300) {
    let dt: Date;

    const onMouseDown = () => {
        dt = new Date();
    };
    const onMouseUp = () => {
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

    node.addEventListener("touchstart", onMouseDown);
    node.addEventListener("touchend", onMouseUp);

    return {
        destroy() {
            node.removeEventListener("mousedown", onMouseDown);
            node.removeEventListener("mouseup", onMouseUp);

            node.removeEventListener("touchstart", onMouseDown);
            node.removeEventListener("touchend", onMouseUp);
        },
    };
}
