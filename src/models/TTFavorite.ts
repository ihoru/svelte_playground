import {randomId} from "../lib/utils";

export default class TTFavorite {
    constructor(
        public order: number,
        public title: string = "",
        public url: string = "",
        public id: string = randomId(),
    ) {
    }
}
