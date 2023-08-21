import format from "date-fns/format";

export function dateFormat(date: Date = null) {
    date ??= new Date();
    return format(date, "yyyy-MM-dd");
}

export function randomId() {
    return window.URL.createObjectURL(new Blob([])).substring(31);
}

export function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}
