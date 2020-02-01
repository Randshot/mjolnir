/*
Copyright 2019 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { MatrixGlob } from "matrix-bot-sdk";

export const RECOMMENDATION_BAN = "m.ban";
export const RECOMMENDATION_KICK = "m.kick";
export const RECOMMENDATION_BAN_TYPES = [RECOMMENDATION_BAN, "org.matrix.mjolnir.ban"];
export const RECOMMENDATION_KICK_TYPES = [RECOMMENDATION_KICK, "org.matrix.mjolnir.kick"];

export function recommendationToStable(recommendation: string, unstable = true): string {
    if (RECOMMENDATION_BAN_TYPES.includes(recommendation)) return unstable ? RECOMMENDATION_BAN_TYPES[RECOMMENDATION_BAN_TYPES.length - 1] : RECOMMENDATION_BAN;
    if (RECOMMENDATION_KICK_TYPES.includes(recommendation)) return unstable ? RECOMMENDATION_KICK_TYPES[RECOMMENDATION_KICK_TYPES.length - 1] : RECOMMENDATION_KICK;
    return null;
}

export class ListRule {

    private glob: MatrixGlob;

    constructor(public readonly entity: string, public readonly action: string, public readonly reason: string, public readonly kind: string) {
        this.glob = new MatrixGlob(entity);
    }

    public get recommendation(): string {
        if (RECOMMENDATION_BAN_TYPES.includes(this.action)) return RECOMMENDATION_BAN;
        if (RECOMMENDATION_KICK_TYPES.includes(this.action)) return RECOMMENDATION_KICK;
    }

    public isMatch(entity: string): boolean {
        return this.glob.test(entity);
    }
}
