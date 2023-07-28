import format from "date-fns/format";

export function dateFormat(date: Date = null) {
    date ??= new Date();
    return format(date, "yyyy-MM-dd");
}
